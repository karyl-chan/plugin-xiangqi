import { otherSide } from "../xiangqi/pieces.js";
import type { GameState } from "../game/state.js";
import { retainEndedGame } from "../game/store.js";
import { notifyGameChanged } from "./sse.js";

/**
 * Clock control. Off-by-default. When a game has `state.clock` set:
 *
 *  • on every applied move, `tickClockOnMove(state, at)` subtracts
 *    elapsed time from the just-moved side and adds the increment, then
 *    resets `turnStartedAt` for the new side.
 *  • a global 250ms ticker checks every active game with a clock and
 *    flags timeouts.
 *
 * Timeouts cause an immediate game-end (the timed-out side loses).
 */

const tickers = new Map<string, NodeJS.Timeout>();

export function tickClockOnMove(state: GameState, at: number): void {
  const c = state.clock;
  if (!c) return;
  const elapsed = Math.max(0, at - c.turnStartedAt);
  // The just-moved side is the OPPONENT of the new sideToMove.
  const justMoved = otherSide(state.board.sideToMove);
  // Only credit the increment if the side's clock was still running
  // when they completed the move — otherwise a player whose flag fell
  // between the ticker's 250 ms ticks would get a free `inc` injection.
  if (justMoved === "red") {
    const rem = c.redRemainingMs - elapsed;
    c.redRemainingMs = rem > 0 ? rem + c.incSec * 1000 : 0;
  } else {
    const rem = c.blackRemainingMs - elapsed;
    c.blackRemainingMs = rem > 0 ? rem + c.incSec * 1000 : 0;
  }
  c.turnStartedAt = at;
}

export function startClockTicker(state: GameState, onEnd: () => void): void {
  if (!state.clock) return;
  stopClockTicker(state.sessionId);
  const handle = setInterval(() => {
    if (state.status !== "active" || !state.clock) {
      stopClockTicker(state.sessionId);
      return;
    }
    const now = Date.now();
    const c = state.clock;
    const movingRem =
      state.board.sideToMove === "red" ? c.redRemainingMs : c.blackRemainingMs;
    const elapsedSinceTurnStart = now - c.turnStartedAt;
    if (movingRem - elapsedSinceTurnStart <= 0) {
      const loser = state.board.sideToMove;
      state.status = loser === "red" ? "black_win" : "red_win";
      state.result = {
        winner: loser === "red" ? "black" : "red",
        reason: "timeout",
        at: now,
      };
      state.endedAt = now;
      if (loser === "red") c.redRemainingMs = 0;
      else c.blackRemainingMs = 0;
      retainEndedGame(state);
      notifyGameChanged(state.channelId);
      stopClockTicker(state.sessionId);
      onEnd();
    }
  }, 250);
  if (typeof handle.unref === "function") handle.unref();
  tickers.set(state.sessionId, handle);
}

export function stopClockTicker(sessionId: string): void {
  const t = tickers.get(sessionId);
  if (t) {
    clearInterval(t);
    tickers.delete(sessionId);
  }
}

/** Format remaining ms as `mm:ss`. */
export function formatClockMs(ms: number | null): string {
  if (ms == null) return "∞";
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseClockOption(s: string): { baseSec: number; incSec: number } | null {
  const m = /^(\d+)\+(\d+)$/.exec(s.trim());
  if (!m) return null;
  const base = parseInt(m[1], 10);
  const inc = parseInt(m[2], 10);
  if (!Number.isFinite(base) || !Number.isFinite(inc)) return null;
  if (base < 10 || base > 7200) return null;
  if (inc < 0 || inc > 120) return null;
  return { baseSec: base, incSec: inc };
}
