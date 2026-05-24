import { ROWS, type Board, type Square } from "../board.js";
import type { PieceKind, Side } from "../pieces.js";

/**
 * Notation-parser helpers shared by the Chinese (中文記譜法) and WXF
 * parsers. The two formats disagree on direction tokens and digit style
 * but they look at the board the same way: scan a column for matching
 * pieces, sort by "front-ness" (closer to the opponent's side rank).
 */

export function findPiecesOnFile(
  b: Board,
  side: Side,
  kind: PieceKind,
  col: number,
): Square[] {
  const out: Square[] = [];
  for (let r = 0; r < ROWS; r++) {
    const cell = b.grid[r][col];
    if (cell && cell.side === side && cell.kind === kind) {
      out.push({ row: r, col });
    }
  }
  return out;
}

/** Sort so squares[0] is the FRONT-most piece (closer to opponent). */
export function sortFromFront(side: Side, squares: Square[]): Square[] {
  const copy = squares.slice();
  copy.sort((a, b) => (side === "red" ? b.row - a.row : a.row - b.row));
  return copy;
}
