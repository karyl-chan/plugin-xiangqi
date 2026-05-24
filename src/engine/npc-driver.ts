import { runtime } from "../runtime.js";
import { withChannelLock } from "../game/store.js";
import { allLegalMoves } from "../xiangqi/rules.js";
import { toFen } from "../xiangqi/board.js";
import { parseIccs } from "../xiangqi/notation/parse-iccs.js";
import { applyMoveToGame } from "../flow/move-apply.js";
import { tickClockOnMove } from "../flow/clock.js";
import { type GameState, type AiLevel } from "../game/state.js";
import { bestMove, depthForLevel, shutdownEngine } from "./stockfish.js";

/**
 * Schedule the AI's next move. Called after every non-AI move (the
 * applier doesn't recurse into NPC logic to keep the chokepoint pure).
 *
 *   • Bail out immediately if it isn't an AI's turn or the game isn't
 *     active anymore.
 *   • Wait a randomised ~1.5–4 s "thinking" interval so AI play doesn't
 *     feel instant.
 *   • Re-acquire the channel lock; re-check the same conditions (a
 *     human takeback or resign during the wait must cancel the move).
 *   • Ask the engine for `bestmove`. On failure, pick a uniform random
 *     legal move so the game keeps progressing.
 *
 * Schedules itself recursively until the game ends or the human side
 * has the move.
 */

const timers = new Map<string, NodeJS.Timeout>();

export function scheduleAiStep(state: GameState): void {
  if (state.status !== "active") return;
  const side = state.board.sideToMove;
  const player = side === "red" ? state.red : state.black;
  if (player.kind !== "ai") return;

  const level = player.aiLevel ?? "normal";
  const delay = 1500 + Math.floor(Math.random() * 2500);
  const handle = setTimeout(async () => {
    timers.delete(state.sessionId);
    await runOneStep(state, level);
  }, delay);
  if (typeof handle.unref === "function") handle.unref();
  timers.set(state.sessionId, handle);
}

export function cancelAiStep(sessionId: string): void {
  const h = timers.get(sessionId);
  if (h) {
    clearTimeout(h);
    timers.delete(sessionId);
  }
  shutdownEngine(sessionId);
}

async function runOneStep(state: GameState, level: AiLevel): Promise<void> {
  await withChannelLock(state.channelId, async () => {
    if (state.status !== "active") return;
    const side = state.board.sideToMove;
    const player = side === "red" ? state.red : state.black;
    if (player.kind !== "ai") return;

    const fen = toFen(state.board);
    let uci: string | null = null;
    try {
      uci = await bestMove(state.sessionId, { fen, depth: depthForLevel(level) });
    } catch (e) {
      runtime().log.warn("xiangqi: engine bestMove threw", {
        err: (e as Error).message,
      });
    }

    let from = { row: -1, col: -1 };
    let to = { row: -1, col: -1 };
    let resolved = false;
    if (uci) {
      const parsed = parseIccs(uci);
      if (parsed) {
        from = parsed.from;
        to = parsed.to;
        // Sanity check legality.
        const legal = allLegalMoves(state.board, side).some(
          (m) =>
            m.from.row === from.row &&
            m.from.col === from.col &&
            m.to.row === to.row &&
            m.to.col === to.col,
        );
        if (legal) resolved = true;
      }
    }
    if (!resolved) {
      const legal = allLegalMoves(state.board, side);
      if (legal.length === 0) return; // checkmate/stalemate — applier already finalised
      const pick = legal[Math.floor(Math.random() * legal.length)];
      from = pick.from;
      to = pick.to;
    }

    await applyMoveToGame(state, side, from, to, {
      source: "ai",
      onPostApply: (s, _r) => tickClockOnMove(s, Date.now()),
    });
    if (state.status === "active") {
      scheduleAiStep(state);
    }
  });
}
