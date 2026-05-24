export type Side = "red" | "black";

export type PieceKind =
  | "king"
  | "advisor"
  | "elephant"
  | "horse"
  | "chariot"
  | "cannon"
  | "pawn";

export interface Piece {
  kind: PieceKind;
  side: Side;
}

export const otherSide = (s: Side): Side => (s === "red" ? "black" : "red");

/**
 * Single-character codes for FEN-style serialisation. Uppercase = red,
 * lowercase = black. Mirrors fairy-stockfish's xiangqi FEN ('K' king,
 * 'A' advisor, 'B' elephant, 'N' horse, 'R' chariot, 'C' cannon,
 * 'P' pawn) so the same FEN can be fed straight into the UCCI engine.
 */
const KIND_TO_LETTER: Record<PieceKind, string> = {
  king: "K",
  advisor: "A",
  elephant: "B",
  horse: "N",
  chariot: "R",
  cannon: "C",
  pawn: "P",
};

const LETTER_TO_KIND: Record<string, PieceKind> = {
  K: "king",
  A: "advisor",
  B: "elephant",
  N: "horse",
  R: "chariot",
  C: "cannon",
  P: "pawn",
};

export function pieceToFen(p: Piece): string {
  const l = KIND_TO_LETTER[p.kind];
  return p.side === "red" ? l : l.toLowerCase();
}

export function fenToPiece(c: string): Piece | null {
  const upper = c.toUpperCase();
  const kind = LETTER_TO_KIND[upper];
  if (!kind) return null;
  return { kind, side: c === upper ? "red" : "black" };
}

/**
 * Chinese piece names. Red and black use different glyphs for several
 * pieces (相/象, 仕/士, 俥/車, 傌/馬, 炮/砲, 兵/卒). The parser accepts
 * both but the formatter always emits the side-specific glyph so the
 * channel log reads correctly to humans.
 */
export const CN_NAME: Record<Side, Record<PieceKind, string>> = {
  red: {
    king: "帥",
    advisor: "仕",
    elephant: "相",
    horse: "傌",
    chariot: "俥",
    cannon: "炮",
    pawn: "兵",
  },
  black: {
    king: "將",
    advisor: "士",
    elephant: "象",
    horse: "馬",
    chariot: "車",
    cannon: "砲",
    pawn: "卒",
  },
};

/**
 * Reverse map for parsing — accepts BOTH side variants for each kind,
 * so "炮二平五" can be played by either side. The board state determines
 * the actual mover.
 */
export const CN_GLYPH_TO_KIND: Record<string, PieceKind> = {
  帥: "king",
  將: "king",
  仕: "advisor",
  士: "advisor",
  相: "elephant",
  象: "elephant",
  傌: "horse",
  馬: "horse",
  俥: "chariot",
  車: "chariot",
  炮: "cannon",
  砲: "cannon",
  兵: "pawn",
  卒: "pawn",
};
