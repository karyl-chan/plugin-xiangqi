import { COLS, type Board, type Square } from "../board.js";
import { pseudoMoves } from "../rules.js";
import { CN_GLYPH_TO_KIND, type PieceKind, type Side } from "../pieces.js";
import { ownFileToCol } from "./parse-wxf.js";
import { findPiecesOnFile, sortFromFront } from "./_shared.js";
import type { ParsedMove } from "./parse-iccs.js";

/**
 * Chinese (traditional) move notation. Four-character format, with
 * special two-piece disambiguation that swaps the first two characters
 * for 前/中/後 prefixes.
 *
 * Examples
 *   炮二平五   → cannon file 2 → file 5  (red, Chinese digits)
 *   砲2平5    → cannon file 2 → file 5  (red, Arabic digits — also OK)
 *   馬八進七   → horse file 8 → file 7   (black, Chinese digits — also OK)
 *   車1進1    → chariot file 1 → advance 1 rank
 *   前馬退六   → front horse retreats to file 6
 *
 * Lenient rules (per UX request):
 *   • Piece glyphs are interchangeable across sides (車/俥, 馬/傌, 炮/砲,
 *     象/相, 士/仕, 兵/卒, 將/帥). The actual mover is determined by the
 *     `side` argument (caller's turn check), not the glyph.
 *   • Both Chinese numerals (一二三…) and Arabic digits (1-9) are accepted
 *     for the file digit and the action parameter, in any combination.
 *
 * File numbering counts from `side`'s own RIGHT to LEFT as 1..9.
 */

const CN_DIGITS = "一二三四五六七八九";

function isCnDigit(ch: string): boolean {
  return CN_DIGITS.includes(ch);
}
function isAsciiDigit(ch: string): boolean {
  return /^[1-9]$/.test(ch);
}
function decodeDigit(ch: string): number {
  if (isAsciiDigit(ch)) return parseInt(ch, 10);
  const idx = CN_DIGITS.indexOf(ch);
  if (idx < 0) return NaN;
  return idx + 1;
}

const ACTIONS = "進退平上下";
function isActionChar(ch: string): boolean {
  return ACTIONS.includes(ch);
}
/** Normalise the action verb: 上↔進, 下↔退. */
function canonAction(ch: string): "進" | "退" | "平" | null {
  if (ch === "進" || ch === "上") return "進";
  if (ch === "退" || ch === "下") return "退";
  if (ch === "平") return "平";
  return null;
}

const FRONT_BACK_GLYPHS = new Set(["前", "後", "中"]);
const FRONT_BACK_KINDS: PieceKind[] = ["chariot", "horse", "cannon", "pawn"];

function resolveDestination(
  side: Side,
  kind: PieceKind,
  from: Square,
  action: "進" | "退" | "平",
  param: number,
): Square | null {
  const forward = side === "red" ? 1 : -1;
  if (action === "平") {
    return { row: from.row, col: ownFileToCol(side, param) };
  }
  const signedFwd = (action === "進" ? 1 : -1) * forward;
  if (kind === "chariot" || kind === "cannon" || kind === "pawn" || kind === "king") {
    return { row: from.row + signedFwd * param, col: from.col };
  }
  // Diagonal/jumping: param is destination file (own perspective).
  const toCol = ownFileToCol(side, param);
  const colDelta = toCol - from.col;
  if (kind === "horse") {
    let rowDelta: number;
    if (Math.abs(colDelta) === 1) rowDelta = 2;
    else if (Math.abs(colDelta) === 2) rowDelta = 1;
    else return null;
    return { row: from.row + signedFwd * rowDelta, col: toCol };
  }
  if (kind === "elephant") {
    if (Math.abs(colDelta) !== 2) return null;
    return { row: from.row + signedFwd * 2, col: toCol };
  }
  if (kind === "advisor") {
    if (Math.abs(colDelta) !== 1) return null;
    return { row: from.row + signedFwd * 1, col: toCol };
  }
  return null;
}

export function parseChinese(
  input: string,
  board: Board,
  side: Side,
): ParsedMove | null {
  const s = input.trim();
  if (s.length !== 4) return null;

  const c0 = s[0];
  const c1 = s[1];
  const c2 = s[2];
  const c3 = s[3];

  const action = canonAction(c2);
  if (!action) return null;

  let kind: PieceKind | null = null;
  let from: Square | null = null;

  if (FRONT_BACK_GLYPHS.has(c0)) {
    // Disambig form: <前|中|後><piece><action><param>
    const glyphKind = CN_GLYPH_TO_KIND[c1];
    if (!glyphKind) return null;
    if (!FRONT_BACK_KINDS.includes(glyphKind)) return null;
    kind = glyphKind;
    // Find the file that holds 2+ same-kind same-side pieces.
    for (let c = 0; c < COLS; c++) {
      const sq = findPiecesOnFile(board, side, kind, c);
      if (sq.length >= 2) {
        const sorted = sortFromFront(side, sq);
        if (c0 === "前") from = sorted[0];
        else if (c0 === "後") from = sorted[sorted.length - 1];
        else if (c0 === "中") {
          if (sq.length < 3) return null;
          from = sorted[1];
        }
        break;
      }
    }
  } else {
    // Regular form: <piece><file><action><param>
    const glyphKind = CN_GLYPH_TO_KIND[c0];
    if (!glyphKind) return null;
    kind = glyphKind;
    // Lenient: file digit may be either Chinese or Arabic.
    if (!isCnDigit(c1) && !isAsciiDigit(c1)) return null;
    const file = decodeDigit(c1);
    if (!Number.isFinite(file)) return null;
    const fromCol = ownFileToCol(side, file);
    const sq = findPiecesOnFile(board, side, kind, fromCol);
    if (sq.length === 0) return null;
    if (sq.length === 1) {
      from = sq[0];
    } else {
      // Multiple same-kind on file with no disambig prefix — illegal.
      return null;
    }
  }
  if (!kind || !from) return null;

  // Lenient param: either digit style.
  if (!isCnDigit(c3) && !isAsciiDigit(c3)) return null;
  const param = decodeDigit(c3);
  if (!Number.isFinite(param)) return null;
  const to = resolveDestination(side, kind, from, action, param);
  if (!to) return null;

  const pseudo = pseudoMoves(board, from);
  if (!pseudo.some((p) => p.row === to.row && p.col === to.col)) return null;

  return { from, to };
}

