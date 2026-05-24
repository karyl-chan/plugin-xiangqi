import { describe, expect, it } from "vitest";
import { initialBoard, parseFen, toFen } from "../../src/xiangqi/board.js";

describe("board FEN roundtrip", () => {
  it("initial position has the expected layout", () => {
    const b = initialBoard();
    expect(b.sideToMove).toBe("red");
    expect(b.grid[0][0]).toEqual({ kind: "chariot", side: "red" });
    expect(b.grid[0][4]).toEqual({ kind: "king", side: "red" });
    expect(b.grid[9][4]).toEqual({ kind: "king", side: "black" });
    expect(b.grid[3][0]).toEqual({ kind: "pawn", side: "red" });
    expect(b.grid[6][0]).toEqual({ kind: "pawn", side: "black" });
    expect(b.grid[2][1]).toEqual({ kind: "cannon", side: "red" });
    expect(b.grid[7][7]).toEqual({ kind: "cannon", side: "black" });
  });

  it("roundtrips initial FEN unchanged", () => {
    const fen = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
    expect(toFen(parseFen(fen))).toBe(fen);
  });

  it("parses side-to-move 'b'", () => {
    const fen = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1";
    expect(parseFen(fen).sideToMove).toBe("black");
  });
});
