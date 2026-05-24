import { COLS, type Board, type Square } from "../board.js";
import { pseudoMoves } from "../rules.js";
import type { PieceKind, Side } from "../pieces.js";
import type { ParsedMove } from "./parse-iccs.js";
import { findPiecesOnFile, sortFromFront } from "./_shared.js";

/**
 * WXF (World Xiangqi Federation) algebraic. Examples:
 *
 *   C2.5  — cannon on file 2 moves sideways to file 5
 *   H8+7  — horse on file 8 advances; destination col = file 7
 *   R1+1  — chariot on file 1 advances one rank
 *   R1-1  — chariot on file 1 retreats one rank
 *
 * Letter case = colour: UPPER → red, LOWER → black. File numbers are
 * own-side perspective (right→left as 1..9).
 *
 * Disambiguation when two same-side pieces share a file uses '+' (front)
 * / '-' (back) prefixes instead of the file digit:
 *   +H+5  (front horse advances to file 5)
 *   -P-1  (back pawn retreats one rank)
 *
 * The parser resolves the source square by inspecting `board`; it
 * returns null if the notation parses but doesn't match a piece, so
 * callers (the unifying `parseAny`) can fall through.
 */

const LETTER_TO_KIND: Record<string, PieceKind> = {
  K: "king",
  A: "advisor",
  B: "elephant",
  E: "elephant", // tolerated alias
  N: "horse",
  H: "horse", // tolerated alias
  R: "chariot",
  C: "cannon",
  P: "pawn",
};

const FRONT_BACK_PIECES: PieceKind[] = ["chariot", "horse", "cannon", "pawn"];

function ownFileToCol(side: Side, file: number): number {
  if (side === "red") return 9 - file;       // red counts right→left
  return file - 1;                           // black counts right→left too, but mirrored: col 0 = black's file 1
}

function colToOwnFile(side: Side, col: number): number {
  return side === "red" ? 9 - col : col + 1;
}

/**
 * Resolve the destination square from a parsed WXF move descriptor.
 * `action` is one of '.', '+', '-' (平 / 進 / 退). For sliding pieces
 * on '+'/'-' the param is the rank delta in own perspective; for
 * diagonal/jumping pieces the param is the destination file.
 */
function resolveDestination(
  side: Side,
  kind: PieceKind,
  from: Square,
  action: "." | "+" | "-",
  param: number,
): Square | null {
  const forward = side === "red" ? 1 : -1;
  if (action === ".") {
    // sideways — destination file in own numbering
    const toCol = ownFileToCol(side, param);
    return { row: from.row, col: toCol };
  }
  const stepSign = action === "+" ? 1 : -1;
  if (kind === "chariot" || kind === "cannon" || kind === "pawn" || kind === "king") {
    // Linear movement: param = rank delta. Pawn special case: a pawn
    // after the river that uses '+'/'-' moves one rank, but '+1' is the
    // only sensible delta (a pawn never retreats — '-' is illegal).
    return { row: from.row + stepSign * forward * param, col: from.col };
  }
  // Diagonal-ish (horse / elephant / advisor): param = destination file
  // in own numbering. Row delta is implicit from the piece geometry.
  const toCol = ownFileToCol(side, param);
  const colDelta = toCol - from.col;
  if (kind === "horse") {
    // Horse: rank delta is 2 if |col delta|=1, or 1 if |col delta|=2.
    let rowDelta: number;
    if (Math.abs(colDelta) === 1) rowDelta = 2;
    else if (Math.abs(colDelta) === 2) rowDelta = 1;
    else return null;
    return { row: from.row + stepSign * forward * rowDelta, col: toCol };
  }
  if (kind === "elephant") {
    // Elephant: rank delta is always 2.
    if (Math.abs(colDelta) !== 2) return null;
    return { row: from.row + stepSign * forward * 2, col: toCol };
  }
  if (kind === "advisor") {
    // Advisor: rank delta is always 1.
    if (Math.abs(colDelta) !== 1) return null;
    return { row: from.row + stepSign * forward * 1, col: toCol };
  }
  return null;
}

/**
 * Parse a WXF string against the current board. Returns null if the
 * input doesn't conform to WXF syntax. Returns an unverified
 * {from, to} that the caller must still check against `isLegalForSide`.
 */
export function parseWxf(input: string, board: Board): ParsedMove | null {
  const s = input.trim();
  // Two forms:
  //   <Letter><file 1-9><action><param 1-9>
  //   <+|-><Letter><action><param 1-9>          (disambiguated front/back)
  let kind: PieceKind | null = null;
  let side: Side | null = null;
  let fromCol: number | null = null;
  let action: "." | "+" | "-" | null = null;
  let param = 0;
  let disambig: "front" | "back" | null = null;

  let m = /^([+\-])([KABEHNRCPkabehnrcp])([.\-+])([1-9])$/.exec(s);
  if (m) {
    disambig = m[1] === "+" ? "front" : "back";
    const letter = m[2];
    kind = LETTER_TO_KIND[letter.toUpperCase()] ?? null;
    side = letter === letter.toUpperCase() ? "red" : "black";
    action = m[3] as "." | "+" | "-";
    param = parseInt(m[4], 10);
  } else {
    m = /^([KABEHNRCPkabehnrcp])([1-9])([.\-+])([1-9])$/.exec(s);
    if (!m) return null;
    const letter = m[1];
    kind = LETTER_TO_KIND[letter.toUpperCase()] ?? null;
    side = letter === letter.toUpperCase() ? "red" : "black";
    const file = parseInt(m[2], 10);
    fromCol = ownFileToCol(side, file);
    action = m[3] as "." | "+" | "-";
    param = parseInt(m[4], 10);
  }
  if (!kind || !side || !action) return null;

  // Locate source square.
  let from: Square | null = null;
  if (disambig) {
    if (!FRONT_BACK_PIECES.includes(kind)) return null;
    // Find any file containing 2+ pieces of this kind/colour; first such
    // file is the implied one. (WXF disambig spec.)
    for (let c = 0; c < COLS; c++) {
      const sq = findPiecesOnFile(board, side, kind, c);
      if (sq.length >= 2) {
        const sorted = sortFromFront(side, sq);
        from = disambig === "front" ? sorted[0] : sorted[sorted.length - 1];
        break;
      }
    }
  } else if (fromCol !== null) {
    const sq = findPiecesOnFile(board, side, kind, fromCol);
    if (sq.length === 0) return null;
    if (sq.length === 1) {
      from = sq[0];
    } else {
      // Multiple on a file with no disambig prefix — illegal WXF.
      return null;
    }
  }
  if (!from) return null;

  const to = resolveDestination(side, kind, from, action, param);
  if (!to) return null;

  // Final sanity-check: the destination must be reachable (pseudo-legal).
  const pseudo = pseudoMoves(board, from);
  if (!pseudo.some((p) => p.row === to.row && p.col === to.col)) return null;

  return { from, to };
}

export { ownFileToCol, colToOwnFile };
