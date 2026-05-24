import { type Board } from "../xiangqi/board.js";
import { CN_NAME } from "../xiangqi/pieces.js";

const FILES_RED_BOTTOM = "九 八 七 六 五 四 三 二 一";
// Full-width Arabic digits (U+FF11 etc.) so each column occupies the
// same width as a CJK piece glyph in Discord's monospace font, aligning
// black's file headers with the cell columns below.
const FILES_BLACK_TOP = "１ ２ ３ ４ ５ ６ ７ ８ ９";

/**
 * Discord-friendly board render. Two glyphs wide per square (Chinese
 * characters), with file numbers in each side's perspective at the top
 * (black) and bottom (red). The river is rendered with the canonical
 * "楚河漢界" label between rows.
 *
 * Callers wrap the result in a code block.
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
    if (i === 4) lines.push(" ━ ━ ━ 楚 河 漢 界 ━ ━ ━");
  }
  lines.push(FILES_RED_BOTTOM);
  return lines.join("\n");
}
