import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installFakeRuntime } from "../_helpers.js";
import { buildPendingGame } from "../../src/game/state.js";
import { _resetStoreForTests, setGame } from "../../src/game/store.js";
import { applyMoveToGame } from "../../src/flow/move-apply.js";
import { onGuildMessageCreate } from "../../src/flow/move-watcher.js";

describe("move-apply chokepoint", () => {
  beforeEach(() => {
    installFakeRuntime();
  });
  afterEach(() => {
    _resetStoreForTests();
  });

  function makeActiveGame() {
    const g = buildPendingGame({
      channelId: "C1",
      guildId: "G1",
      challenger: { userId: "U-red", displayName: "Red", kind: "human" },
      invitee: { userId: "U-black", displayName: "Black", kind: "human" },
      challengerPlaysSide: "red",
      clock: null,
    });
    g.status = "active";
    setGame("C1", g);
    return g;
  }

  it("applies a legal move, formats it, and pushes history", async () => {
    const g = makeActiveGame();
    const out = await applyMoveToGame(
      g,
      "red",
      { row: 2, col: 7 },
      { row: 2, col: 4 },
      { source: "webui" },
    );
    expect(out.ended).toBe(false);
    expect(g.history.length).toBe(1);
    expect(g.history[0].formattedZh).toBe("炮二平五");
    expect(g.history[0].formattedIccs).toBe("h2e2");
    expect(g.board.sideToMove).toBe("black");
  });

  it("source=channel-message does not echo back to channel", async () => {
    const { botRpcCalls } = installFakeRuntime();
    const g = makeActiveGame();
    await applyMoveToGame(
      g,
      "red",
      { row: 2, col: 7 },
      { row: 2, col: 4 },
      { source: "channel-message" },
    );
    const sendCalls = botRpcCalls.filter((c) => c.path === "/api/plugin/messages.send");
    expect(sendCalls.length).toBe(0);
  });

  it("source=webui echoes the move via messages.send", async () => {
    const { botRpcCalls } = installFakeRuntime();
    const g = makeActiveGame();
    await applyMoveToGame(
      g,
      "red",
      { row: 2, col: 7 },
      { row: 2, col: 4 },
      { source: "webui" },
    );
    const sendCalls = botRpcCalls.filter((c) => c.path === "/api/plugin/messages.send");
    expect(sendCalls.length).toBe(1);
  });
});

describe("channel-message watcher → move-apply", () => {
  beforeEach(() => {
    installFakeRuntime();
  });
  afterEach(() => {
    _resetStoreForTests();
  });

  it("parses '炮二平五' from a red player's message and applies", async () => {
    const g = buildPendingGame({
      channelId: "C2",
      guildId: "G1",
      challenger: { userId: "U-red", displayName: "Red", kind: "human" },
      invitee: { userId: "U-black", displayName: "Black", kind: "human" },
      challengerPlaysSide: "red",
      clock: null,
    });
    g.status = "active";
    setGame("C2", g);

    await onGuildMessageCreate({
      channel_id: "C2",
      guild_id: "G1",
      content: "好棋！炮二平五",
      author: { id: "U-red", bot: false },
    });
    expect(g.history.length).toBe(1);
    expect(g.history[0].formattedZh).toBe("炮二平五");
    expect(g.board.sideToMove).toBe("black");
  });

  it("ignores messages from a non-player", async () => {
    const g = buildPendingGame({
      channelId: "C3",
      guildId: "G1",
      challenger: { userId: "U-red", displayName: "Red", kind: "human" },
      invitee: { userId: "U-black", displayName: "Black", kind: "human" },
      challengerPlaysSide: "red",
      clock: null,
    });
    g.status = "active";
    setGame("C3", g);

    await onGuildMessageCreate({
      channel_id: "C3",
      guild_id: "G1",
      content: "炮二平五",
      author: { id: "U-bystander", bot: false },
    });
    expect(g.history.length).toBe(0);
  });

  it("ignores wrong-side moves", async () => {
    const g = buildPendingGame({
      channelId: "C4",
      guildId: "G1",
      challenger: { userId: "U-red", displayName: "Red", kind: "human" },
      invitee: { userId: "U-black", displayName: "Black", kind: "human" },
      challengerPlaysSide: "red",
      clock: null,
    });
    g.status = "active";
    setGame("C4", g);

    // Black tries to play during red's turn.
    await onGuildMessageCreate({
      channel_id: "C4",
      guild_id: "G1",
      content: "車1進1",
      author: { id: "U-black", bot: false },
    });
    expect(g.history.length).toBe(0);
  });
});
