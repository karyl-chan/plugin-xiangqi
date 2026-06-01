import { getGame, withChannelLock } from "../game/store.js";
import { isOfferPending, sideOf, type GameState } from "../game/state.js";
import { parseAny } from "../xiangqi/notation/parse.js";
import { applyMoveToGame, isMoversTurn } from "./move-apply.js";
import { tickClockOnMove } from "./clock.js";
import { scheduleAiStep } from "../engine/npc-driver.js";
import { addReaction, sendMessage } from "./discord.js";
import { t, sideLabel } from "../i18n/index.js";
import { EMBED_COLOR_OFFER } from "../constants.js";
import { runtime } from "../runtime.js";

/**
 * The game is paused on a pending draw/takeback offer, but a player just
 * typed move notation into the channel. Post an embed reminder that the
 * offer must be resolved first — the move is NOT applied.
 */
async function postPauseReminder(game: GameState): Promise<void> {
  let description: string;
  if (game.drawOffer) {
    description = t(game.locale, "pause.drawPending", {
      side: sideLabel(game.locale, game.drawOffer.from),
    });
  } else if (game.takebackOffer) {
    description = t(game.locale, "pause.takebackPending", {
      side: sideLabel(game.locale, game.takebackOffer.from),
      plies: game.takebackOffer.plies,
    });
  } else {
    return;
  }
  await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        title: t(game.locale, "pause.title"),
        color: EMBED_COLOR_OFFER,
        description,
      },
    ],
  });
}

/**
 * Inbound `guild.message_create` handler. Filters non-game messages out
 * by reading the channel's active game (or doing nothing). When the
 * author is the current side-to-move AND the message parses as a legal
 * move, applies it through the shared chokepoint and adds a 👌
 * reaction to the original message as feedback.
 *
 * Everything else is silently ignored — keeps casual channel chat
 * usable while a game is active.
 */
export async function onGuildMessageCreate(payload: {
  /** Message snowflake — used to add the 👌 reaction after a valid move. */
  id?: string;
  channel_id: string;
  guild_id?: string | null;
  content?: string;
  author: { id: string; bot?: boolean };
}): Promise<void> {
  if (payload.author.bot) return;
  if (!payload.guild_id) return;
  if (typeof payload.content !== "string" || payload.content.length === 0) return;

  const channelId = payload.channel_id;
  const moved = await withChannelLock(channelId, async () => {
    const game = getGame(channelId);
    if (!game || game.status !== "active") return false;
    const movingSide = sideOf(game, payload.author.id);
    if (!movingSide) return false;
    // Parse first so we can tell a move attempt apart from normal chat.
    const parsed = parseAny(payload.content!, game.board, movingSide);
    if (!parsed) return false;
    // Paused on a pending offer: a typed move is met with a reminder, not
    // applied — neither side may move until the offer is resolved.
    if (isOfferPending(game)) {
      await postPauseReminder(game);
      return false;
    }
    if (!isMoversTurn(game, movingSide)) return false;
    try {
      await applyMoveToGame(game, movingSide, parsed.from, parsed.to, {
        source: "channel-message",
        onPostApply: (s) => tickClockOnMove(s, Date.now()),
      });
    } catch (e) {
      runtime().log.warn("xiangqi: applyMove failed", {
        err: (e as Error).message,
        channelId,
      });
      return false;
    }
    if (game.status === "active") {
      const stm = game.board.sideToMove === "red" ? game.red : game.black;
      if (stm.kind === "ai") scheduleAiStep(game);
    }
    return true;
  });
  // Reaction outside the lock — non-essential ack; if it fails (e.g. the
  // message was deleted between parse and react) the move still stands.
  if (moved && payload.id) {
    try {
      await addReaction({
        channelId,
        messageId: payload.id,
        emoji: "👌",
      });
    } catch {
      /* ignore */
    }
  }
}
