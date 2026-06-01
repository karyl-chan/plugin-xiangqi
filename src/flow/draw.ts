import type {
  CommandContext,
  CommandReply,
  ComponentContext,
  ComponentReply,
} from "@karyl-chan/plugin-sdk";
import { t, sideLabel, resolveLocale } from "../i18n/index.js";
import { EMBED_COLOR_DRAW, EMBED_COLOR_OFFER } from "../constants.js";
import {
  getGame,
  retainEndedGame,
  withChannelLock,
} from "../game/store.js";
import { isOfferPending, sideOf, type GameState } from "../game/state.js";
import { type Side } from "../xiangqi/pieces.js";
import { notifyGameChanged } from "./sse.js";
import {
  sendMessage,
  deleteMessage,
  buttonRow,
  buildCustomId,
  ephemeralFollowup,
} from "./discord.js";
import { stopClockTicker } from "./clock.js";
import { cancelAiStep } from "../engine/npc-driver.js";

/**
 * Delete the actionable draw-offer post once it's been resolved (from
 * either the Discord buttons or the WebUI), so a stale Accept/Decline
 * row can't be clicked after the offer is gone. No-op when the offer was
 * never posted to the channel (e.g. vs-AI).
 */
async function deleteDrawOfferMessage(game: GameState): Promise<void> {
  const id = game.drawOffer?.messageId;
  if (id) await deleteMessage({ channelId: game.channelId, messageId: id });
}

export type DrawOfferResult = "offered" | "vs_ai_declined";

/**
 * Pure helpers shared by Discord + WebUI. The caller holds the channel
 * lock and has already validated that the actor is a player on the
 * given side. The Discord post still carries Discord-side buttons; WebUI
 * users see and respond to the same offer via the snapshot's
 * `drawOffer` field.
 */
export async function applyOfferDrawBySide(
  game: GameState,
  side: Side,
): Promise<DrawOfferResult> {
  const opponent = side === "red" ? game.black : game.red;
  if (opponent.kind === "ai") return "vs_ai_declined";
  game.drawOffer = { from: side, at: Date.now() };
  notifyGameChanged(game.channelId);
  const sent = await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        title: t(game.locale, "draw.offerTitle"),
        color: EMBED_COLOR_OFFER,
        description: t(game.locale, "draw.offered", {
          side: sideLabel(game.locale, side),
        }),
      },
    ],
    components: [
      buttonRow([
        {
          label: t(game.locale, "draw.acceptBtn"),
          customId: buildCustomId("draw-acc", game.sessionId),
          style: 3,
        },
        {
          label: t(game.locale, "draw.declineBtn"),
          customId: buildCustomId("draw-dec", game.sessionId),
          style: 4,
        },
      ]),
    ],
  });
  if (sent && game.drawOffer) game.drawOffer.messageId = sent.id;
  return "offered";
}

export async function applyAcceptDrawBySide(game: GameState): Promise<void> {
  await deleteDrawOfferMessage(game);
  game.status = "draw";
  game.result = { reason: "draw_agreed", at: Date.now() };
  game.endedAt = Date.now();
  game.drawOffer = undefined;
  stopClockTicker(game.sessionId);
  cancelAiStep(game.sessionId);
  retainEndedGame(game);
  notifyGameChanged(game.channelId);
  await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        title: t(game.locale, "board.gameOver"),
        color: EMBED_COLOR_DRAW,
        description: t(game.locale, "end.drawAgreed"),
      },
    ],
  });
}

export async function applyDeclineDrawBySide(game: GameState): Promise<void> {
  await deleteDrawOfferMessage(game);
  game.drawOffer = undefined;
  notifyGameChanged(game.channelId);
  await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        color: EMBED_COLOR_DRAW,
        description: t(game.locale, "draw.declined"),
      },
    ],
  });
}

export async function handleDraw(ctx: CommandContext): Promise<CommandReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) return t(ctxLocale, "error.notInGuild");
  return withChannelLock(channelId, async () => {
    const game = getGame(channelId);
    if (!game || game.status !== "active") {
      return { content: t(ctxLocale, "error.noGame"), ephemeral: true };
    }
    const side = sideOf(game, ctx.userId);
    if (!side) {
      return { content: t(ctxLocale, "error.notPlayer"), ephemeral: true };
    }
    if (isOfferPending(game)) {
      return { content: t(ctxLocale, "pause.cannotMove"), ephemeral: true };
    }
    const result = await applyOfferDrawBySide(game, side);
    if (result === "vs_ai_declined") {
      return { content: t(ctxLocale, "draw.declined"), ephemeral: true };
    }
    return {
      content: t(ctxLocale, "draw.offered", {
        side: sideLabel(ctxLocale, side),
      }),
      ephemeral: true,
    };
  });
}

export async function handleDrawAcceptButton(
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
    if (!game || game.sessionId !== sessionId || !game.drawOffer) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noGame"));
      return;
    }
    const side = sideOf(game, ctx.userId);
    if (!side || side === game.drawOffer.from) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    // applyAcceptDrawBySide deletes the offer post (this very message) and
    // posts the game-over embed, so we don't edit the message here.
    await applyAcceptDrawBySide(game);
    return;
  });
}

export async function handleDrawDeclineButton(
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
    if (!game || game.sessionId !== sessionId || !game.drawOffer) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noGame"));
      return;
    }
    const side = sideOf(game, ctx.userId);
    if (!side || side === game.drawOffer.from) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    // Deletes the offer post (this message) and posts the declined embed.
    await applyDeclineDrawBySide(game);
    return;
  });
}
