import { getGame, withChannelLock } from "../game/store.js";
import { sideOf } from "../game/state.js";
import { parseAny } from "../xiangqi/notation/parse.js";
import { applyMoveToGame, isMoversTurn } from "./move-apply.js";
import { tickClockOnMove } from "./clock.js";
import { scheduleAiStep } from "../engine/npc-driver.js";
import { addReaction } from "./discord.js";
import { runtime } from "../runtime.js";

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
    if (!isMoversTurn(game, movingSide)) return false;
    const parsed = parseAny(payload.content!, game.board, movingSide);
    if (!parsed) return false;
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
