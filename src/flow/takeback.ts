import type {
  CommandContext,
  CommandReply,
  ComponentContext,
  ComponentReply,
} from "@karyl-chan/plugin-sdk";
import { t, sideLabel, resolveLocale } from "../i18n/index.js";
import { EMBED_COLOR_DRAW, EMBED_COLOR_OFFER } from "../constants.js";
import { getGame, withChannelLock } from "../game/store.js";
import {
  isOfferPending,
  sideOf,
  positionKey,
  type GameState,
} from "../game/state.js";
import { initialBoard } from "../xiangqi/board.js";
import { applyMove } from "../xiangqi/moves.js";
import { notifyGameChanged } from "./sse.js";
import {
  sendMessage,
  deleteMessage,
  buttonRow,
  buildCustomId,
  ephemeralFollowup,
} from "./discord.js";

/**
 * Delete the actionable takeback-offer post once it's resolved (Discord
 * buttons or WebUI), so a stale Agree/Decline row can't be clicked after
 * the offer is gone.
 */
async function deleteTakebackOfferMessage(game: GameState): Promise<void> {
  const id = game.takebackOffer?.messageId;
  if (id) await deleteMessage({ channelId: game.channelId, messageId: id });
}

/**
 * Takeback semantics:
 *   • vs human: the requester is offered up. The opponent must approve;
 *     once approved, the last N plies are rolled back (N = 1 by default,
 *     2 if it isn't the requester's turn — so they actually undo their
 *     own last move).
 *   • vs AI: no opponent ack needed; immediately retract 2 plies (the
 *     AI's last move + the human's last move) so the human is back to
 *     move from a state they were happy with.
 */

function rollbackPlies(state: GameState, n: number): void {
  const target = state.history.length - n;
  if (target < 0) return;
  // Re-replay from initial position. v1 always starts from initialBoard;
  // if custom starting positions are ever added, this should reset from
  // a stored starting FEN on GameState instead.
  const fresh = initialBoard();
  state.board = fresh;
  const keepHistory = state.history.slice(0, target);
  state.history = keepHistory;
  state.positionKeys = [positionKey(fresh)];
  for (const mv of keepHistory) {
    applyMove(state.board, mv.from, mv.to);
    state.positionKeys.push(positionKey(state.board));
  }
}

export type TakebackOfferOutcome =
  | { kind: "offered"; plies: 1 | 2 }
  | { kind: "applied_ai"; plies: 1 | 2 }
  | { kind: "no_history" };

import { type Side } from "../xiangqi/pieces.js";

function pliesForRequester(game: GameState, side: Side): 1 | 2 {
  return game.board.sideToMove === side
    ? game.history.length >= 2
      ? 2
      : 1
    : 1;
}

/**
 * Pure helpers shared by Discord + WebUI. The caller holds the channel
 * lock and has already validated the actor's side. vs-AI takebacks
 * apply immediately; vs-human ones post an offer that either side can
 * resolve from either UI.
 */
export async function applyOfferTakebackBySide(
  game: GameState,
  side: Side,
): Promise<TakebackOfferOutcome> {
  if (game.history.length === 0) return { kind: "no_history" };
  const opponent = side === "red" ? game.black : game.red;
  const plies = pliesForRequester(game, side);

  if (opponent.kind === "ai") {
    rollbackPlies(game, plies);
    notifyGameChanged(game.channelId);
    await sendMessage({
      channelId: game.channelId,
      embeds: [
        {
          color: EMBED_COLOR_DRAW,
          description: t(game.locale, "takeback.appliedAi", { plies }),
        },
      ],
    });
    return { kind: "applied_ai", plies };
  }

  game.takebackOffer = { from: side, plies, at: Date.now() };
  notifyGameChanged(game.channelId);
  const sent = await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        title: t(game.locale, "takeback.offerTitle"),
        color: EMBED_COLOR_OFFER,
        description: t(game.locale, "takeback.offered", {
          side: sideLabel(game.locale, side),
          plies,
        }),
      },
    ],
    components: [
      buttonRow([
        {
          label: t(game.locale, "takeback.acceptBtn"),
          customId: buildCustomId("tb-acc", game.sessionId),
          style: 3,
        },
        {
          label: t(game.locale, "takeback.declineBtn"),
          customId: buildCustomId("tb-dec", game.sessionId),
          style: 4,
        },
      ]),
    ],
  });
  if (sent && game.takebackOffer) game.takebackOffer.messageId = sent.id;
  return { kind: "offered", plies };
}

export async function applyAcceptTakebackBySide(
  game: GameState,
): Promise<{ plies: 1 | 2 }> {
  const plies = game.takebackOffer!.plies;
  await deleteTakebackOfferMessage(game);
  rollbackPlies(game, plies);
  game.takebackOffer = undefined;
  notifyGameChanged(game.channelId);
  await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        color: EMBED_COLOR_DRAW,
        description: t(game.locale, "takeback.applied", { plies }),
      },
    ],
  });
  return { plies };
}

export async function applyDeclineTakebackBySide(
  game: GameState,
): Promise<void> {
  await deleteTakebackOfferMessage(game);
  game.takebackOffer = undefined;
  notifyGameChanged(game.channelId);
  await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        color: EMBED_COLOR_DRAW,
        description: t(game.locale, "takeback.declined"),
      },
    ],
  });
}

export async function handleTakeback(ctx: CommandContext): Promise<CommandReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) return t(ctxLocale, "error.notInGuild");
  return withChannelLock(channelId, async () => {
    const game = getGame(channelId);
    if (!game || game.status !== "active") {
      return { content: t(ctxLocale, "error.noGame"), ephemeral: true };
    }
    const side = sideOf(game, ctx.userId);
    if (!side) return { content: t(ctxLocale, "error.notPlayer"), ephemeral: true };
    if (isOfferPending(game)) {
      return { content: t(ctxLocale, "pause.cannotMove"), ephemeral: true };
    }
    const outcome = await applyOfferTakebackBySide(game, side);
    if (outcome.kind === "no_history") {
      return { content: t(ctxLocale, "error.noGame"), ephemeral: true };
    }
    if (outcome.kind === "applied_ai") {
      // The public "rolled back" embed is posted by the shared helper;
      // this is just the requester's private ack.
      return {
        content: t(ctxLocale, "takeback.appliedAi", { plies: outcome.plies }),
        ephemeral: true,
      };
    }
    return {
      content: t(ctxLocale, "takeback.offered", {
        side: sideLabel(ctxLocale, side),
        plies: outcome.plies,
      }),
      ephemeral: true,
    };
  });
}

export async function handleTakebackAcceptButton(
  ctx: ComponentContext,
  sessionId: string,
): Promise<ComponentReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) {
    await ephemeralFollowup(ctx, t(ctxLocale, "error.notInGuild"));
    return;
  }
  return withChannelLock(channelId, async () => {
    const game = getGame(channelId);
    if (!game || game.sessionId !== sessionId || !game.takebackOffer) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noGame"));
      return;
    }
    const side = sideOf(game, ctx.userId);
    if (!side || side === game.takebackOffer.from) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    // Deletes the offer post (this message) and posts the applied embed.
    await applyAcceptTakebackBySide(game);
    return;
  });
}

export async function handleTakebackDeclineButton(
  ctx: ComponentContext,
  sessionId: string,
): Promise<ComponentReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) {
    await ephemeralFollowup(ctx, t(ctxLocale, "error.notInGuild"));
    return;
  }
  return withChannelLock(channelId, async () => {
    const game = getGame(channelId);
    if (!game || game.sessionId !== sessionId || !game.takebackOffer) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noGame"));
      return;
    }
    const side = sideOf(game, ctx.userId);
    if (!side || side === game.takebackOffer.from) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    // Deletes the offer post (this message) and posts the declined embed.
    await applyDeclineTakebackBySide(game);
    return;
  });
}
