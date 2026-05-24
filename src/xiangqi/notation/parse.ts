import type { Board } from "../board.js";
import { isLegalForSide } from "../rules.js";
import { getCell } from "../board.js";
import type { Side } from "../pieces.js";
import { parseIccs, type ParsedMove } from "./parse-iccs.js";
import { parseWxf } from "./parse-wxf.js";
import { parseChinese } from "./parse-chinese.js";

const CN_PIECE_GLYPHS = /[車馬象相士仕將帥兵卒炮砲俥傌帥]/;
const FRONT_BACK = /[前中後]/;
const CN_NUMERAL = /[一二三四五六七八九]/;
const CN_ACTION = /[進退平上下]/;

/**
 * Trim noise (mentions, emoji, surrounding punctuation) from a candidate
 * move string so things like "好棋！炮二平五" or "<@123> 炮二平五" still
 * match the inner four-char move.
 */
function extractMoveCandidates(input: string): string[] {
  const out: string[] = [];
  out.push(input.trim());

  // Discard a leading discord mention or quote.
  const stripped = input
    .replace(/<@!?[0-9]+>/g, " ")
    .replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, " ")
    .replace(/[*_~`>"'!?。，,]/g, " ")
    .trim();
  if (stripped && stripped !== out[0]) out.push(stripped);

  // Try the longest single-run of recognised glyphs anywhere in the
  // string (lets users add words around the move).
  const cnRun = stripped.match(
    new RegExp(
      `[${"前中後車馬象相士仕將帥兵卒炮砲俥傌一二三四五六七八九0-9進退平上下"}]+`,
      "g",
    ),
  );
  if (cnRun) {
    for (const r of cnRun) if (r.length === 4) out.push(r);
  }

  // ICCS: a four-char ASCII run.
  const iccsRun = stripped.match(/[a-iA-I][0-9][a-iA-I][0-9]/g);
  if (iccsRun) {
    for (const r of iccsRun) out.push(r);
  }

  // WXF: short ASCII tokens.
  const wxfRun = stripped.match(/[+\-]?[KABEHNRCPkabehnrcp][1-9][.\-+][1-9]/g);
  if (wxfRun) {
    for (const r of wxfRun) out.push(r);
  }

  return Array.from(new Set(out));
}

/**
 * Best-effort move parser. Walks the input through every supported
 * notation, returning the first match that is also LEGAL for the
 * expected side. `expectedSide` defaults to `board.sideToMove`.
 *
 *  - returns ParsedMove when something matched AND the move is legal
 *  - returns null when nothing matched, or matches failed legality
 *
 * Callers (the channel message watcher) treat null as "this wasn't a
 * move" and silently ignore — that's the right behaviour for messages
 * that are casual chat.
 */
export function parseAny(
  rawInput: string,
  board: Board,
  expectedSide?: Side,
): ParsedMove | null {
  const side = expectedSide ?? board.sideToMove;
  const candidates = extractMoveCandidates(rawInput);
  for (const cand of candidates) {
    const tried = tryParse(cand, board, side);
    if (!tried) continue;
    const piece = getCell(board, tried.from);
    if (!piece || piece.side !== side) continue;
    if (!isLegalForSide(board, tried.from, tried.to, side)) continue;
    return tried;
  }
  return null;
}

function tryParse(s: string, board: Board, side: Side): ParsedMove | null {
  // ICCS is the cheapest and most-specific check.
  const iccs = parseIccs(s);
  if (iccs) return iccs;
  // WXF before Chinese — its letter prefix can't collide with the
  // Chinese glyph set.
  const wxf = parseWxf(s, board);
  if (wxf) return wxf;
  // Chinese form requires 4 chars with at least one piece glyph.
  if (s.length === 4 && (CN_PIECE_GLYPHS.test(s) || FRONT_BACK.test(s))) {
    if (CN_NUMERAL.test(s) || /[0-9]/.test(s)) {
      if (CN_ACTION.test(s)) {
        return parseChinese(s, board, side);
      }
    }
  }
  return null;
}
