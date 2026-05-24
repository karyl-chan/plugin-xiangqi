import { toFen } from "../xiangqi/board.js";
import { allLegalMoves } from "../xiangqi/rules.js";
import { type Side } from "../xiangqi/pieces.js";
import {
  type GameState,
  type GameStatus,
  type MoveRecord,
  type PlayerRef,
  sideOf,
} from "./state.js";

export interface SnapshotMove {
  /** Half-move index (1-based for display). */
  ply: number;
  side: Side;
  from: { row: number; col: number };
  to: { row: number; col: number };
  zh: string;
  iccs: string;
  combined: string;
  at: number;
}

export interface SnapshotPlayer extends PlayerRef {
  remainingMs: number | null;
}

export interface SnapshotView {
  sessionId: string;
  channelId: string;
  guildId: string;
  status: GameStatus;
  /** "red" / "black" / "spectator" — what role the viewer holds. */
  viewerRole: "red" | "black" | "spectator";
  red: SnapshotPlayer;
  black: SnapshotPlayer;
  fen: string;
  sideToMove: Side;
  /**
   * Server-computed candidate move set FROM each of the viewer's own
   * pieces (only on the viewer's turn). Empty for spectators or off-turn.
   * Lets the WebUI render legal-move highlights without re-implementing
   * the rule engine in the browser.
   */
  legalMovesByFrom: Record<string, { row: number; col: number }[]>;
  history: SnapshotMove[];
  drawOffer: { from: Side } | null;
  takebackOffer: { from: Side; plies: number } | null;
  result: GameState["result"] | null;
  challengerUserId: string;
  hasAi: boolean;
}

function squareKey(s: { row: number; col: number }): string {
  return `${s.row},${s.col}`;
}

export function buildSnapshot(state: GameState, viewerUserId: string): SnapshotView {
  const role: SnapshotView["viewerRole"] = (sideOf(state, viewerUserId) ?? "spectator") as
    | "red"
    | "black"
    | "spectator";

  const remaining = computeRemaining(state);
  const legalMovesByFrom: Record<string, { row: number; col: number }[]> = {};
  if (
    state.status === "active" &&
    (role === "red" || role === "black") &&
    role === state.board.sideToMove
  ) {
    for (const m of allLegalMoves(state.board, role)) {
      const key = squareKey(m.from);
      if (!legalMovesByFrom[key]) legalMovesByFrom[key] = [];
      legalMovesByFrom[key].push(m.to);
    }
  }

  return {
    sessionId: state.sessionId,
    channelId: state.channelId,
    guildId: state.guildId,
    status: state.status,
    viewerRole: role,
    red: { ...state.red, remainingMs: remaining.red },
    black: { ...state.black, remainingMs: remaining.black },
    fen: toFen(state.board),
    sideToMove: state.board.sideToMove,
    legalMovesByFrom,
    history: state.history.map((h, i) => moveToSnapshot(h, i)),
    drawOffer: state.drawOffer ? { from: state.drawOffer.from } : null,
    takebackOffer: state.takebackOffer
      ? { from: state.takebackOffer.from, plies: state.takebackOffer.plies }
      : null,
    result: state.result ?? null,
    challengerUserId: state.challengerUserId,
    hasAi: state.red.kind === "ai" || state.black.kind === "ai",
  };
}

function moveToSnapshot(r: MoveRecord, idx: number): SnapshotMove {
  return {
    ply: idx + 1,
    side: r.side,
    from: r.from,
    to: r.to,
    zh: r.formattedZh,
    iccs: r.formattedIccs,
    combined: r.combined,
    at: r.at,
  };
}

function computeRemaining(state: GameState): { red: number | null; black: number | null } {
  if (!state.clock) return { red: null, black: null };
  const c = state.clock;
  if (state.status !== "active") {
    return { red: c.redRemainingMs, black: c.blackRemainingMs };
  }
  // Decrement the side-to-move's clock by elapsed since last turn start.
  const elapsed = Math.max(0, Date.now() - c.turnStartedAt);
  if (state.board.sideToMove === "red") {
    return {
      red: Math.max(0, c.redRemainingMs - elapsed),
      black: c.blackRemainingMs,
    };
  }
  return {
    red: c.redRemainingMs,
    black: Math.max(0, c.blackRemainingMs - elapsed),
  };
}
