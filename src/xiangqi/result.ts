import type { Board } from "./board.js";
import { isInCheck, allLegalMoves } from "./rules.js";
import { otherSide, type Side } from "./pieces.js";

/**
 * Reasons a game can end at the rule level. Surrenders / draw agreements /
 * time-outs / aborts are decided at the application layer, not here.
 */
export type EndReason =
  | "checkmate"           // side-to-move has no legal moves AND is in check
  | "stalemate"           // side-to-move has no legal moves AND is not in check — xiangqi treats this as a LOSS for the side that can't move
  | "halfmove_60"         // 120 half-moves without a capture (60-move rule)
  | "ongoing";

export interface PositionResult {
  reason: EndReason;
  /**
   * Defined only when `reason` !== "ongoing".
   * For checkmate & stalemate, the side to move has lost — `winner` is
   * the opposing side. For the 60-move draw, `winner` is null.
   */
  winner: Side | null;
}

/**
 * Pure position-only result. Does not check threefold repetition because
 * that needs the move history; the game-state layer feeds repetition in
 * separately if it wants to claim a draw.
 */
export function evaluatePosition(b: Board): PositionResult {
  const side = b.sideToMove;
  const moves = allLegalMoves(b, side);
  if (moves.length === 0) {
    if (isInCheck(b, side)) {
      return { reason: "checkmate", winner: otherSide(side) };
    }
    // Xiangqi convention: the player who cannot move loses (no draw).
    return { reason: "stalemate", winner: otherSide(side) };
  }
  if (b.halfMoveClock >= 120) {
    return { reason: "halfmove_60", winner: null };
  }
  return { reason: "ongoing", winner: null };
}

/**
 * Threefold repetition check given a flat FEN-position history. The
 * caller is expected to push the side-to-move-stripped position key
 * (so "same board, same turn" repeats line up). Returns true when the
 * latest position has appeared at least 3 times in the history.
 */
export function isThreefoldRepetition(positionKeys: string[]): boolean {
  if (positionKeys.length === 0) return false;
  const latest = positionKeys[positionKeys.length - 1];
  let count = 0;
  for (const k of positionKeys) {
    if (k === latest) count += 1;
    if (count >= 3) return true;
  }
  return false;
}
