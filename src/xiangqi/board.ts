import { fenToPiece, pieceToFen, type Piece, type Side } from "./pieces.js";

/**
 * Board coordinate system. The grid is 10 rows × 9 columns:
 *
 *   row 0 = red's back rank   (帥 starts at col 4, row 0)
 *   row 9 = black's back rank (將 starts at col 4, row 9)
 *
 *   col 0 = ICCS file 'a' = red's far left (= black's far right)
 *   col 8 = ICCS file 'i' = red's far right (= black's far left)
 *
 * `board[row][col]` holds a Piece or null.
 *
 * Chinese-notation file numbering (own-side perspective, right→left):
 *   redFile(col)   = 9 - col   (col 0 → 九, col 8 → 一)
 *   blackFile(col) = col + 1   (col 0 → 1, col 8 → 9)
 */
export const ROWS = 10;
export const COLS = 9;

export type Square = { row: number; col: number };
export type Cell = Piece | null;
export type Grid = Cell[][];

export interface Board {
  grid: Grid;
  sideToMove: Side;
  /** Half-moves since the last capture; for the 60-move (120-half-move) rule. */
  halfMoveClock: number;
  /** Increments after every black move (matches FEN convention). */
  fullMove: number;
}

export function emptyGrid(): Grid {
  const g: Grid = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = new Array(COLS).fill(null);
    g.push(row);
  }
  return g;
}

export function cloneBoard(b: Board): Board {
  return {
    grid: b.grid.map((row) => row.slice()),
    sideToMove: b.sideToMove,
    halfMoveClock: b.halfMoveClock,
    fullMove: b.fullMove,
  };
}

export function getCell(b: Board, sq: Square): Cell {
  if (sq.row < 0 || sq.row >= ROWS) return null;
  if (sq.col < 0 || sq.col >= COLS) return null;
  return b.grid[sq.row][sq.col];
}

export function setCell(b: Board, sq: Square, piece: Cell): void {
  b.grid[sq.row][sq.col] = piece;
}

export function eq(a: Square, b: Square): boolean {
  return a.row === b.row && a.col === b.col;
}

export function inBoard(sq: Square): boolean {
  return sq.row >= 0 && sq.row < ROWS && sq.col >= 0 && sq.col < COLS;
}

/** True if (row, col) is inside the given side's 3×3 palace. */
export function inPalace(side: Side, sq: Square): boolean {
  if (sq.col < 3 || sq.col > 5) return false;
  if (side === "red") return sq.row >= 0 && sq.row <= 2;
  return sq.row >= 7 && sq.row <= 9;
}

/** True if the square is on the given side's own half of the river. */
export function onOwnSide(side: Side, sq: Square): boolean {
  return side === "red" ? sq.row <= 4 : sq.row >= 5;
}

export function initialBoard(): Board {
  // Standard opening position. Construct via FEN to avoid manual layout drift.
  return parseFen(
    "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1",
  );
}

/**
 * Parses a fairy-stockfish-compatible xiangqi FEN. Rank order in the FEN
 * is black-first (top of board first) per FEN convention, which is the
 * OPPOSITE of our internal row ordering — black sits at row 9 here,
 * row 0 in the FEN string. The loop below mirrors as it parses.
 *
 * Supports the standard 6 fields; only the first four are meaningful for
 * us (halfmove clock and fullmove number).
 */
export function parseFen(fen: string): Board {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`invalid FEN (need at least placement and side): ${fen}`);
  }
  const [placement, sideField, , , halfStr, fullStr] = parts;
  const grid = emptyGrid();
  const ranks = placement.split("/");
  if (ranks.length !== ROWS) {
    throw new Error(`invalid FEN: need ${ROWS} ranks, got ${ranks.length}`);
  }
  for (let i = 0; i < ROWS; i++) {
    const row = ROWS - 1 - i; // FEN rank 0 = top of board = our row 9
    const rankStr = ranks[i];
    let col = 0;
    for (const ch of rankStr) {
      if (col >= COLS) throw new Error(`invalid FEN: rank ${i} too wide`);
      if (/[1-9]/.test(ch)) {
        col += parseInt(ch, 10);
      } else {
        const piece = fenToPiece(ch);
        if (!piece) throw new Error(`invalid FEN piece: ${ch}`);
        grid[row][col] = piece;
        col++;
      }
    }
    if (col !== COLS) throw new Error(`invalid FEN: rank ${i} wrong width ${col}`);
  }
  const sideToMove: Side = sideField === "w" ? "red" : "black";
  const halfMoveClock = halfStr ? parseInt(halfStr, 10) : 0;
  const fullMove = fullStr ? parseInt(fullStr, 10) : 1;
  return { grid, sideToMove, halfMoveClock, fullMove };
}

export function toFen(b: Board): string {
  const lines: string[] = [];
  for (let i = 0; i < ROWS; i++) {
    const row = ROWS - 1 - i;
    let line = "";
    let blanks = 0;
    for (let c = 0; c < COLS; c++) {
      const cell = b.grid[row][c];
      if (!cell) {
        blanks++;
      } else {
        if (blanks > 0) {
          line += String(blanks);
          blanks = 0;
        }
        line += pieceToFen(cell);
      }
    }
    if (blanks > 0) line += String(blanks);
    lines.push(line);
  }
  const sideField = b.sideToMove === "red" ? "w" : "b";
  return `${lines.join("/")} ${sideField} - - ${b.halfMoveClock} ${b.fullMove}`;
}

export function findPieces(
  b: Board,
  predicate: (p: Piece, sq: Square) => boolean,
): Square[] {
  const out: Square[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = b.grid[r][c];
      if (p && predicate(p, { row: r, col: c })) out.push({ row: r, col: c });
    }
  }
  return out;
}

export function findKing(b: Board, side: Side): Square | null {
  const matches = findPieces(b, (p) => p.kind === "king" && p.side === side);
  return matches[0] ?? null;
}
