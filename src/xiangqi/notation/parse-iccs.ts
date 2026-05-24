import type { Square } from "../board.js";

export interface ParsedMove {
  from: Square;
  to: Square;
}

/**
 * ICCS coordinates: `<file><rank><file><rank>` where file is 'a'..'i'
 * (a = col 0 = red's far left) and rank is '0'..'9' (0 = red's back).
 * Case-insensitive. Returns null when the input doesn't match.
 */
export function parseIccs(input: string): ParsedMove | null {
  const m = /^([a-iA-I])([0-9])([a-iA-I])([0-9])$/.exec(input.trim());
  if (!m) return null;
  const fromCol = m[1].toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
  const fromRow = parseInt(m[2], 10);
  const toCol = m[3].toLowerCase().charCodeAt(0) - "a".charCodeAt(0);
  const toRow = parseInt(m[4], 10);
  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
  };
}

export function formatIccs(move: ParsedMove): string {
  const fileChar = (c: number) => String.fromCharCode("a".charCodeAt(0) + c);
  return `${fileChar(move.from.col)}${move.from.row}${fileChar(move.to.col)}${move.to.row}`;
}
