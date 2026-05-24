import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installFakeRuntime } from "../_helpers.js";
import { buildPendingGame } from "../../src/game/state.js";
import { _resetStoreForTests, setGame } from "../../src/game/store.js";
import { applyMoveToGame } from "../../src/flow/move-apply.js";

describe("threefold repetition", () => {
  beforeEach(() => {
    installFakeRuntime();
  });
  afterEach(() => {
    _resetStoreForTests();
  });

  it("ends with reason 'repetition' (not halfmove_60) when the position repeats 3 times", async () => {
    const g = buildPendingGame({
      channelId: "C-rep",
      guildId: "G1",
      challenger: { userId: "U-red", displayName: "Red", kind: "human" },
      invitee: { userId: "U-black", displayName: "Black", kind: "human" },
      challengerPlaysSide: "red",
      clock: null,
    });
    g.status = "active";
    setGame("C-rep", g);

    // Both sides shuffle their chariots back and forth: a0→a1→a0…
    // Red's chariot at (0,0) ↔ (1,0); black's chariot at (9,0) ↔ (8,0).
    // After 3 cycles we revisit the initial position 3 times (counting
    // the start state), triggering the threefold rule.
    const cycle = async () => {
      await applyMoveToGame(g, "red",   { row: 0, col: 0 }, { row: 1, col: 0 }, { source: "webui" });
      await applyMoveToGame(g, "black", { row: 9, col: 0 }, { row: 8, col: 0 }, { source: "webui" });
      await applyMoveToGame(g, "red",   { row: 1, col: 0 }, { row: 0, col: 0 }, { source: "webui" });
      await applyMoveToGame(g, "black", { row: 8, col: 0 }, { row: 9, col: 0 }, { source: "webui" });
    };
    await cycle();
    await cycle();
    expect(g.status).toBe("draw");
    expect(g.result?.reason).toBe("repetition");
  });
});
