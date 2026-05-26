import { type Board } from "../xiangqi/board.js";
import { CN_NAME } from "../xiangqi/pieces.js";

const FILES_RED_BOTTOM = "九 八 七 六 五 四 三 二 一";
// Full-width Arabic digits (U+FF11 etc.) so each column occupies the
// same width as a CJK piece glyph in Discord's monospace font, aligning
// black's file headers with the cell columns below.
const FILES_BLACK_TOP = "１ ２ ３ ４ ５ ６ ７ ８ ９";
// River label uses the same 9-cell + 8-space layout as every other row
// so the columns line up. "楚河漢界" sits in cols 3-6 with three ━ left
// of it and two ━ right; the asymmetry is the only way to fit a 4-char
// label inside 9 cells.
const RIVER_LINE = ["━", "━", "━", "楚", "河", "漢", "界", "━", "━"].join(" ");

/**
 * Width-forcing rule rendered just above the board's code block. Discord
 * embed widths are driven by the longest NON-code-block line in the
 * description; code-block contents don't contribute to that sizing. So
 * if everything else above the board is shorter than a board row (the
 * common case when the move-line / banner text is brief), the embed
 * collapses narrow and the code block has to soft-wrap board rows on
 * desktop — the board fragments visually.
 *
 * U+FF0D FULLWIDTH HYPHEN-MINUS is guaranteed CJK-wide (East Asian
 * Width: Fullwidth) so 17 copies of it always render around 17 × 2 ≈ 34
 * ASCII-width units in Discord's CJK font, which exceeds the 9-cell +
 * 8-space board row inside the code block on every client we've tested.
 *
 * Exported so all four embed-building sites (start, move, board cmd,
 * end banner) share the same width invariant — divergence is what
 * caused the original wrap.
 */
export const BOARD_TOP_RULE = "－".repeat(17);

/**
 * Discord-friendly board render. Two glyphs wide per square (Chinese
 * characters), with file numbers in each side's perspective at the top
 * (black) and bottom (red). The river is rendered with the canonical
 * "楚河漢界" label between rows.
 *
 * Callers wrap the result in a code block and should prepend
 * `BOARD_TOP_RULE` to the description so the embed renders wide enough
 * for the code-block rows to fit on one line each.
 */
export function renderBoardText(b: Board): string {
  const lines: string[] = [];
  lines.push(FILES_BLACK_TOP);
  for (let i = 0; i < 10; i++) {
    const row = 9 - i; // top to bottom on screen
    const cells: string[] = [];
    for (let c = 0; c < 9; c++) {
      const piece = b.grid[row][c];
      cells.push(piece ? CN_NAME[piece.side][piece.kind] : "．");
    }
    lines.push(cells.join(" "));
    if (i === 4) lines.push(RIVER_LINE);
  }
  lines.push(FILES_RED_BOTTOM);
  return lines.join("\n");
}
