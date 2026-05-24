import {
  COLS,
  ROWS,
  cloneBoard,
  findKing,
  findPieces,
  getCell,
  inBoard,
  inPalace,
  onOwnSide,
  setCell,
  type Board,
  type Square,
} from "./board.js";
import { otherSide, type Side } from "./pieces.js";

/**
 * Pseudo-legal move generation per piece kind. "Pseudo-legal" = obeys
 * movement rules but does NOT check whether the moving side ends in
 * check / faces an illegal flying-general. The legal-move filter in
 * `moves.ts` does that second pass.
 */

function pushIfTarget(
  b: Board,
  side: Side,
  to: Square,
  out: Square[],
): void {
  if (!inBoard(to)) return;
  const cell = getCell(b, to);
  if (cell && cell.side === side) return;
  out.push(to);
}

function kingMoves(b: Board, from: Square, side: Side): Square[] {
  const out: Square[] = [];
  const deltas: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dr, dc] of deltas) {
    const to: Square = { row: from.row + dr, col: from.col + dc };
    if (!inPalace(side, to)) continue;
    pushIfTarget(b, side, to, out);
  }
  return out;
}

function advisorMoves(b: Board, from: Square, side: Side): Square[] {
  const out: Square[] = [];
  const deltas: Array<[number, number]> = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const [dr, dc] of deltas) {
    const to: Square = { row: from.row + dr, col: from.col + dc };
    if (!inPalace(side, to)) continue;
    pushIfTarget(b, side, to, out);
  }
  return out;
}

function elephantMoves(b: Board, from: Square, side: Side): Square[] {
  const out: Square[] = [];
  const deltas: Array<[number, number]> = [
    [2, 2],
    [2, -2],
    [-2, 2],
    [-2, -2],
  ];
  for (const [dr, dc] of deltas) {
    const to: Square = { row: from.row + dr, col: from.col + dc };
    if (!inBoard(to)) continue;
    if (!onOwnSide(side, to)) continue;            // elephants can't cross the river
    const eye: Square = { row: from.row + dr / 2, col: from.col + dc / 2 };
    if (getCell(b, eye)) continue;                 // 塞象眼 (blocked diagonal centre)
    pushIfTarget(b, side, to, out);
  }
  return out;
}

function horseMoves(b: Board, from: Square, side: Side): Square[] {
  const out: Square[] = [];
  // The classic 8 L-jumps, each preceded by an orthogonal "leg" square
  // that must be empty to allow the jump.
  const jumps: Array<{ leg: [number, number]; jump: [number, number] }> = [
    { leg: [1, 0],  jump: [2, 1] },
    { leg: [1, 0],  jump: [2, -1] },
    { leg: [-1, 0], jump: [-2, 1] },
    { leg: [-1, 0], jump: [-2, -1] },
    { leg: [0, 1],  jump: [1, 2] },
    { leg: [0, 1],  jump: [-1, 2] },
    { leg: [0, -1], jump: [1, -2] },
    { leg: [0, -1], jump: [-1, -2] },
  ];
  for (const { leg, jump } of jumps) {
    const legSq: Square = { row: from.row + leg[0], col: from.col + leg[1] };
    if (!inBoard(legSq) || getCell(b, legSq)) continue;
    const to: Square = { row: from.row + jump[0], col: from.col + jump[1] };
    pushIfTarget(b, side, to, out);
  }
  return out;
}

function chariotMoves(b: Board, from: Square, side: Side): Square[] {
  const out: Square[] = [];
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dr, dc] of dirs) {
    let r = from.row + dr;
    let c = from.col + dc;
    while (inBoard({ row: r, col: c })) {
      const cell = getCell(b, { row: r, col: c });
      if (!cell) {
        out.push({ row: r, col: c });
      } else {
        if (cell.side !== side) out.push({ row: r, col: c });
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return out;
}

function cannonMoves(b: Board, from: Square, side: Side): Square[] {
  const out: Square[] = [];
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dr, dc] of dirs) {
    let r = from.row + dr;
    let c = from.col + dc;
    // Phase 1: move like a chariot through empty squares.
    while (inBoard({ row: r, col: c })) {
      const cell = getCell(b, { row: r, col: c });
      if (cell) {
        // Phase 2: with exactly one screen, the next non-empty square
        // along this ray must be an enemy piece (capture by jumping over
        // the screen). Skip empty squares; stop at the first piece.
        let r2 = r + dr;
        let c2 = c + dc;
        while (inBoard({ row: r2, col: c2 })) {
          const cell2 = getCell(b, { row: r2, col: c2 });
          if (cell2) {
            if (cell2.side !== side) out.push({ row: r2, col: c2 });
            break;
          }
          r2 += dr;
          c2 += dc;
        }
        break;
      }
      out.push({ row: r, col: c });
      r += dr;
      c += dc;
    }
  }
  return out;
}

function pawnMoves(b: Board, from: Square, side: Side): Square[] {
  const out: Square[] = [];
  const forward = side === "red" ? 1 : -1;
  const fwd: Square = { row: from.row + forward, col: from.col };
  pushIfTarget(b, side, fwd, out);
  // After crossing the river, pawns also move sideways one step.
  if (!onOwnSide(side, from)) {
    pushIfTarget(b, side, { row: from.row, col: from.col + 1 }, out);
    pushIfTarget(b, side, { row: from.row, col: from.col - 1 }, out);
  }
  return out;
}

/**
 * Pseudo-legal moves for the piece at `from`. Returns [] if no piece or
 * the piece doesn't belong to the side-to-move (callers must check
 * ownership themselves when they want a specific subset).
 */
export function pseudoMoves(b: Board, from: Square): Square[] {
  const p = getCell(b, from);
  if (!p) return [];
  switch (p.kind) {
    case "king":
      return kingMoves(b, from, p.side);
    case "advisor":
      return advisorMoves(b, from, p.side);
    case "elephant":
      return elephantMoves(b, from, p.side);
    case "horse":
      return horseMoves(b, from, p.side);
    case "chariot":
      return chariotMoves(b, from, p.side);
    case "cannon":
      return cannonMoves(b, from, p.side);
    case "pawn":
      return pawnMoves(b, from, p.side);
  }
}

/**
 * Flying-general check: if no piece sits between the two kings along
 * their shared file, the position is illegal (they would "see" each
 * other and can capture along the file). Functionally a hard rule —
 * any move that produces this is invalid.
 */
export function kingsFacing(b: Board): boolean {
  const rk = findKing(b, "red");
  const bk = findKing(b, "black");
  if (!rk || !bk) return false;
  if (rk.col !== bk.col) return false;
  const lo = Math.min(rk.row, bk.row);
  const hi = Math.max(rk.row, bk.row);
  for (let r = lo + 1; r < hi; r++) {
    if (b.grid[r][rk.col]) return false;
  }
  return true;
}

/** True if `side`'s king is currently under attack by the opposing side. */
export function isInCheck(b: Board, side: Side): boolean {
  const king = findKing(b, side);
  if (!king) return true;
  const enemies = findPieces(b, (p) => p.side !== side);
  for (const sq of enemies) {
    const moves = pseudoMoves(b, sq);
    for (const m of moves) {
      if (m.row === king.row && m.col === king.col) return true;
    }
  }
  return false;
}

/**
 * Apply a candidate move without legality filtering — used by the legal
 * generator below to roll forward and probe whether the moving side
 * lands in check.
 */
export function applyMoveUnchecked(
  b: Board,
  from: Square,
  to: Square,
): { captured: ReturnType<typeof getCell>; next: Board } {
  const next = cloneBoard(b);
  const moving = getCell(next, from);
  const captured = getCell(next, to);
  setCell(next, to, moving);
  setCell(next, from, null);
  if (captured) {
    next.halfMoveClock = 0;
  } else {
    next.halfMoveClock += 1;
  }
  if (next.sideToMove === "black") next.fullMove += 1;
  next.sideToMove = otherSide(next.sideToMove);
  return { captured, next };
}

export function isLegalForSide(
  b: Board,
  from: Square,
  to: Square,
  side: Side,
): boolean {
  const piece = getCell(b, from);
  if (!piece || piece.side !== side) return false;
  const pseudo = pseudoMoves(b, from);
  if (!pseudo.some((m) => m.row === to.row && m.col === to.col)) return false;
  const { next } = applyMoveUnchecked(b, from, to);
  if (kingsFacing(next)) return false;
  if (isInCheck(next, side)) return false;
  return true;
}

export function legalMovesFrom(
  b: Board,
  from: Square,
  side: Side,
): Square[] {
  const piece = getCell(b, from);
  if (!piece || piece.side !== side) return [];
  return pseudoMoves(b, from).filter((to) =>
    isLegalForSide(b, from, to, side),
  );
}

export function allLegalMoves(
  b: Board,
  side: Side,
): Array<{ from: Square; to: Square }> {
  const out: Array<{ from: Square; to: Square }> = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = b.grid[r][c];
      if (!piece || piece.side !== side) continue;
      const from = { row: r, col: c };
      for (const to of legalMovesFrom(b, from, side)) {
        out.push({ from, to });
      }
    }
  }
  return out;
}
