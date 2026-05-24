import { getCell, type Board, type Square } from "../board.js";
import {
  CN_NAME,
  type PieceKind,
  type Side,
} from "../pieces.js";
import { formatIccs } from "./parse-iccs.js";
import { colToOwnFile } from "./parse-wxf.js";

const CN_DIGITS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const FRONT_BACK_KINDS: PieceKind[] = ["chariot", "horse", "cannon", "pawn"];

function digit(side: Side, n: number): string {
  if (side === "red") return CN_DIGITS[n - 1];
  return String(n);
}

function actionGlyph(side: Side, from: Square, to: Square): "進" | "退" | "平" {
  if (from.row === to.row) return "平";
  const forward = side === "red" ? 1 : -1;
  return (to.row - from.row) * forward > 0 ? "進" : "退";
}

function paramFor(
  kind: PieceKind,
  side: Side,
  from: Square,
  to: Square,
  action: "進" | "退" | "平",
): number {
  if (action === "平") return colToOwnFile(side, to.col);
  if (kind === "chariot" || kind === "cannon" || kind === "pawn" || kind === "king") {
    return Math.abs(to.row - from.row);
  }
  return colToOwnFile(side, to.col);
}

function disambigPrefix(
  board: Board,
  kind: PieceKind,
  side: Side,
  from: Square,
): string | null {
  if (!FRONT_BACK_KINDS.includes(kind)) return null;
  const onFile: Square[] = [];
  for (let r = 0; r < 10; r++) {
    const c = board.grid[r][from.col];
    if (c && c.side === side && c.kind === kind) onFile.push({ row: r, col: from.col });
  }
  if (onFile.length < 2) return null;
  onFile.sort((a, b) => (side === "red" ? b.row - a.row : a.row - b.row));
  const idx = onFile.findIndex((s) => s.row === from.row && s.col === from.col);
  // 2-3 same-file: 前/中/後 is the conventional spelling.
  if (onFile.length <= 3) {
    if (idx === 0) return "前";
    if (idx === onFile.length - 1) return "後";
    return "中";
  }
  // ≥4 same-file (only pawns can reach this — chariots, horses, cannons
  // top out at 2 per side): switch to positional 一/二/三/四/五 (red) or
  // 1/2/3/4/5 (black) so every slot has a unique name.
  return digit(side, idx + 1);
}

/**
 * Render a move in Chinese notation against the PRE-move board (so the
 * mover's piece is still at `from`). Two-on-a-file is disambiguated with
 * 前/中/後; ≥4 pawns on a file switch to positional digits.
 */
export function toChinese(board: Board, from: Square, to: Square): string {
  const piece = getCell(board, from);
  if (!piece) throw new Error("toChinese: no piece at source");
  const side = piece.side;
  const kind = piece.kind;
  const action = actionGlyph(side, from, to);
  const param = paramFor(kind, side, from, to, action);
  const paramStr = digit(side, param);
  const pieceGlyph = CN_NAME[side][kind];

  const prefix = disambigPrefix(board, kind, side, from);
  if (prefix) {
    return `${prefix}${pieceGlyph}${action}${paramStr}`;
  }
  const fileStr = digit(side, colToOwnFile(side, from.col));
  return `${pieceGlyph}${fileStr}${action}${paramStr}`;
}

/** "炮二平五 (h2e2)" — the bot-echo format used in channel messages. */
export function toChineseAndIccs(board: Board, from: Square, to: Square): {
  zh: string;
  iccs: string;
  combined: string;
} {
  const zh = toChinese(board, from, to);
  const iccs = formatIccs({ from, to });
  return { zh, iccs, combined: `${zh} (${iccs})` };
}
