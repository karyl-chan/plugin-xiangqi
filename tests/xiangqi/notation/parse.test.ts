import { describe, expect, it } from "vitest";
import { initialBoard, parseFen } from "../../../src/xiangqi/board.js";
import { parseAny } from "../../../src/xiangqi/notation/parse.js";
import { parseIccs } from "../../../src/xiangqi/notation/parse-iccs.js";
import { parseWxf } from "../../../src/xiangqi/notation/parse-wxf.js";
import { parseChinese } from "../../../src/xiangqi/notation/parse-chinese.js";
import {
  toChinese,
  toChineseAndIccs,
} from "../../../src/xiangqi/notation/format.js";

describe("ICCS parser", () => {
  it("parses h2e2 → cannon-five-flat-five", () => {
    expect(parseIccs("h2e2")).toEqual({
      from: { row: 2, col: 7 },
      to: { row: 2, col: 4 },
    });
  });

  it("returns null for noise", () => {
    expect(parseIccs("foo")).toBeNull();
    expect(parseIccs("h22")).toBeNull();
    expect(parseIccs("j2e2")).toBeNull();
  });
});

describe("Chinese parser — opening cannon-two-flat-five", () => {
  it("炮二平五 from initial position", () => {
    const b = initialBoard();
    const m = parseChinese("炮二平五", b, "red");
    expect(m).toEqual({ from: { row: 2, col: 7 }, to: { row: 2, col: 4 } });
  });

  it("馬八進七 from initial position", () => {
    const b = initialBoard();
    const m = parseChinese("馬八進七", b, "red");
    expect(m).toEqual({ from: { row: 0, col: 1 }, to: { row: 2, col: 2 } });
  });

  it("車1進1 — black, Arabic digits", () => {
    const b = initialBoard();
    const m = parseChinese("車1進1", b, "black");
    expect(m).toEqual({ from: { row: 9, col: 0 }, to: { row: 8, col: 0 } });
  });

  it("accepts mixed numeral styles (lenient)", () => {
    const b = initialBoard();
    // Red playing with Arabic digits — should resolve the same as 炮二平五.
    expect(parseChinese("砲2平5", b, "red")).toEqual({
      from: { row: 2, col: 7 },
      to: { row: 2, col: 4 },
    });
    // Black playing with Chinese digits.
    expect(parseChinese("車一進一", b, "black")).toEqual({
      from: { row: 9, col: 0 },
      to: { row: 8, col: 0 },
    });
  });

  it("accepts cross-side glyphs for either player", () => {
    const b = initialBoard();
    // Red using 砲 (black's glyph) — should still parse for red.
    expect(parseChinese("砲二平五", b, "red")).toEqual({
      from: { row: 2, col: 7 },
      to: { row: 2, col: 4 },
    });
    // Black using 俥 (red's glyph) — should still parse for black.
    expect(parseChinese("俥1進1", b, "black")).toEqual({
      from: { row: 9, col: 0 },
      to: { row: 8, col: 0 },
    });
  });

  it("rejects when no matching piece on the file", () => {
    const b = initialBoard();
    expect(parseChinese("車五進一", b, "red")).toBeNull();
  });
});

describe("WXF parser", () => {
  it("C2.5 = cannon file 2 flat-to-5 (red)", () => {
    const b = initialBoard();
    const m = parseWxf("C2.5", b);
    expect(m).toEqual({ from: { row: 2, col: 7 }, to: { row: 2, col: 4 } });
  });

  it("H8+7 = red horse file 8 advances to file 7", () => {
    const b = initialBoard();
    const m = parseWxf("H8+7", b);
    expect(m).toEqual({ from: { row: 0, col: 1 }, to: { row: 2, col: 2 } });
  });

  it("r1+1 = black chariot file 1 advances 1 rank", () => {
    const b = initialBoard();
    const m = parseWxf("r1+1", b);
    expect(m).toEqual({ from: { row: 9, col: 0 }, to: { row: 8, col: 0 } });
  });
});

describe("parseAny — unified entry point", () => {
  it("accepts ICCS h2e2", () => {
    const b = initialBoard();
    expect(parseAny("h2e2", b)).toEqual({
      from: { row: 2, col: 7 },
      to: { row: 2, col: 4 },
    });
  });

  it("accepts Chinese 炮二平五", () => {
    const b = initialBoard();
    expect(parseAny("炮二平五", b)).toEqual({
      from: { row: 2, col: 7 },
      to: { row: 2, col: 4 },
    });
  });

  it("accepts WXF C2.5", () => {
    const b = initialBoard();
    expect(parseAny("C2.5", b)).toEqual({
      from: { row: 2, col: 7 },
      to: { row: 2, col: 4 },
    });
  });

  it("extracts a move embedded in chat text", () => {
    const b = initialBoard();
    expect(parseAny("先來個 炮二平五！", b)).toEqual({
      from: { row: 2, col: 7 },
      to: { row: 2, col: 4 },
    });
  });

  it("returns null for ordinary chat", () => {
    const b = initialBoard();
    expect(parseAny("好棋啊", b)).toBeNull();
    expect(parseAny("👍", b)).toBeNull();
  });

  it("lenient: '車1進1' on red's turn resolves to red's own chariot", () => {
    // With strict-style mapping removed, "車1進1" no longer implies black.
    // For red to move it picks the red chariot at file 1 (own perspective):
    // red's file 1 = col 8, chariot at (0,8), advances one rank to (1,8).
    const b = initialBoard();
    expect(parseAny("車1進1", b)).toEqual({
      from: { row: 0, col: 8 },
      to: { row: 1, col: 8 },
    });
  });

  it("rejects an illegal-but-syntactic move", () => {
    const b = initialBoard();
    expect(parseAny("a0a3", b)).toBeNull(); // chariot blocked at a0 going to a3
  });
});

describe("Chinese formatter", () => {
  it("formats cannon-two-flat-five from initial board", () => {
    const b = initialBoard();
    const s = toChinese(b, { row: 2, col: 7 }, { row: 2, col: 4 });
    expect(s).toBe("炮二平五");
  });

  it("formats horse advance for red", () => {
    const b = initialBoard();
    const s = toChinese(b, { row: 0, col: 1 }, { row: 2, col: 2 });
    expect(s).toBe("傌八進七");
  });

  it("formats chariot advance for black", () => {
    const fen = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1";
    const b = parseFen(fen);
    const s = toChinese(b, { row: 9, col: 0 }, { row: 8, col: 0 });
    expect(s).toBe("車1進1");
  });

  it("combined Chinese + ICCS format", () => {
    const b = initialBoard();
    const r = toChineseAndIccs(b, { row: 2, col: 7 }, { row: 2, col: 4 });
    expect(r.combined).toBe("炮二平五 (h2e2)");
    expect(r.zh).toBe("炮二平五");
    expect(r.iccs).toBe("h2e2");
  });

  it("uses 前/後 to disambiguate two pieces on the same file", () => {
    // Two red cannons on column 1 (red's file 8): rows 2 and 4. Pre-move board.
    // Move the FRONT one (row 4, farther into opponent territory) sideways to col 0.
    const fen = "rnbakabnr/9/4c4/p1p1p1p1p/9/1C7/P1P1P1P1P/1C5c1/9/RNBAKABNR w - - 0 1";
    const b = parseFen(fen);
    const s = toChinese(b, { row: 4, col: 1 }, { row: 4, col: 0 });
    expect(s.startsWith("前")).toBe(true);
  });
});
