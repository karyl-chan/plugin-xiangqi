import {
  cloneBoard,
  getCell,
  setCell,
  toFen,
  type Board,
  type Square,
} from "./board.js";
import { allLegalMoves, isLegalForSide } from "./rules.js";
import { otherSide, type Piece, type Side } from "./pieces.js";

export interface AppliedMove {
  from: Square;
  to: Square;
  moved: Piece;
  captured: Piece | null;
  side: Side;
  fenBefore: string;
  fenAfter: string;
}

/**
 * Apply a fully-checked move. Throws if the move isn't legal for the
 * side-to-move — callers (the parser, the WebUI action route, the AI
 * driver) are expected to validate first; this helper just commits.
 */
export function applyMove(b: Board, from: Square, to: Square): AppliedMove {
  const moving = getCell(b, from);
  if (!moving) throw new Error("no piece at source square");
  if (moving.side !== b.sideToMove) {
    throw new Error(
      `wrong side to move: piece is ${moving.side}, turn is ${b.sideToMove}`,
    );
  }
  if (!isLegalForSide(b, from, to, b.sideToMove)) {
    throw new Error("move is not legal");
  }
  const fenBefore = toFen(b);
  const captured = getCell(b, to);
  setCell(b, to, moving);
  setCell(b, from, null);
  if (captured) {
    b.halfMoveClock = 0;
  } else {
    b.halfMoveClock += 1;
  }
  if (b.sideToMove === "black") b.fullMove += 1;
  b.sideToMove = otherSide(b.sideToMove);
  const fenAfter = toFen(b);
  return {
    from,
    to,
    moved: moving,
    captured,
    side: moving.side,
    fenBefore,
    fenAfter,
  };
}

export function legalMoveCount(b: Board, side: Side): number {
  return allLegalMoves(b, side).length;
}

/**
 * Convenience copy-and-apply for hypothetical exploration (mostly for
 * the AI driver and tests). The original board is unchanged.
 */
export function withMoveApplied(b: Board, from: Square, to: Square): Board {
  const copy = cloneBoard(b);
  applyMove(copy, from, to);
  return copy;
}
