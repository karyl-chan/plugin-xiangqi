import { randomBytes } from "node:crypto";
import {
  initialBoard,
  toFen,
  type Board,
  type Square,
} from "../xiangqi/board.js";
import type { Side } from "../xiangqi/pieces.js";
import type { Locale } from "../i18n/index.js";

export type GameStatus =
  | "pending_accept"
  | "active"
  | "red_win"
  | "black_win"
  | "draw"
  | "aborted";

export type AiLevel = "easy" | "normal" | "hard";

export interface PlayerRef {
  /** Discord user id for humans, or "ai:<level>" for the AI. */
  userId: string;
  displayName: string;
  avatarUrl?: string;
  kind: "human" | "ai";
  aiLevel?: AiLevel;
}

export interface MoveRecord {
  side: Side;
  from: Square;
  to: Square;
  capturedFen?: string;
  fenAfter: string;
  formattedZh: string;
  formattedIccs: string;
  combined: string;
  /** Source that caused this move; drives "echo into channel" behaviour. */
  source: "channel-message" | "webui" | "ai";
  /** Discord message id of the bot-echoed move post, if any. */
  echoMessageId?: string;
  at: number;
}

export interface ClockState {
  baseSec: number;
  incSec: number;
  redRemainingMs: number;
  blackRemainingMs: number;
  /** Wallclock ms the active side's clock started running. */
  turnStartedAt: number;
}

export interface DrawOffer {
  from: Side;
  at: number;
  /** Discord message id of the actionable offer post, for later deletion. */
  messageId?: string;
}
export interface TakebackOffer {
  from: Side;
  plies: 1 | 2;
  at: number;
  /** Discord message id of the actionable offer post, for later deletion. */
  messageId?: string;
}

export type EndReason =
  | "checkmate"
  | "stalemate"
  | "resign"
  | "draw_agreed"
  | "timeout"
  | "halfmove_60"
  | "repetition"
  | "aborted";

export interface GameState {
  sessionId: string;
  channelId: string;
  guildId: string;

  red: PlayerRef;
  black: PlayerRef;
  /** User id of the player who ran /xiangqi start (auto-assigned to red). */
  challengerUserId: string;

  board: Board;
  history: MoveRecord[];
  /** FEN-stripped position keys (placement + side-to-move only). */
  positionKeys: string[];

  status: GameStatus;
  result?: { winner?: Side; reason: EndReason; at: number };

  drawOffer?: DrawOffer;
  takebackOffer?: TakebackOffer;
  clock: ClockState | null;
  /**
   * UI preference set at game start. When false, bot-proxied move posts
   * (webui / AI source) become plain text move notation with no embed,
   * no session id, no move number — closer to a "blindfold" log. When
   * true, every bot move post is a rich embed with the board snapshot.
   */
  showBoard: boolean;

  /**
   * Locale used for every channel-facing text the bot writes for this
   * game (move echoes, end banners, draw / takeback announcements).
   * Captured from the challenger's interaction at game-creation time so
   * the channel-side conversation stays in one language even when the
   * two players have different Discord client locales.
   */
  locale: Locale;

  /** Discord message id of the pending invite message (pending_accept stage). */
  inviteMessageId?: string;
  /** Discord message id of the last public-board post we made. */
  lastBoardMessageId?: string;

  createdAt: number;
  acceptedAt?: number;
  endedAt?: number;
}

export function newSessionId(): string {
  return randomBytes(8).toString("hex");
}

/**
 * Strip the halfmove/fullmove tail from a FEN so repetition detection
 * keys on placement + side-to-move only.
 */
export function positionKey(b: Board): string {
  const fen = toFen(b);
  const fields = fen.split(" ");
  return `${fields[0]} ${fields[1]}`;
}

/**
 * Build a brand-new game in `pending_accept`. The board is set up but
 * no clock is started until the invite is accepted.
 */
export function buildPendingGame(opts: {
  channelId: string;
  guildId: string;
  challenger: PlayerRef;
  invitee: PlayerRef;
  challengerPlaysSide: Side;
  clock: { baseSec: number; incSec: number } | null;
  showBoard?: boolean;
  locale: Locale;
}): GameState {
  const board = initialBoard();
  const challengerSide = opts.challengerPlaysSide;
  const red = challengerSide === "red" ? opts.challenger : opts.invitee;
  const black = challengerSide === "red" ? opts.invitee : opts.challenger;
  const clock: ClockState | null = opts.clock
    ? {
        baseSec: opts.clock.baseSec,
        incSec: opts.clock.incSec,
        redRemainingMs: opts.clock.baseSec * 1000,
        blackRemainingMs: opts.clock.baseSec * 1000,
        turnStartedAt: Date.now(),
      }
    : null;
  return {
    sessionId: newSessionId(),
    channelId: opts.channelId,
    guildId: opts.guildId,
    red,
    black,
    challengerUserId: opts.challenger.userId,
    board,
    history: [],
    positionKeys: [positionKey(board)],
    status: "pending_accept",
    clock,
    showBoard: opts.showBoard ?? false,
    locale: opts.locale,
    createdAt: Date.now(),
  };
}

/**
 * True while a draw or takeback offer is awaiting a response. The game
 * is "paused" in this state: no moves may be played (from the channel or
 * the WebUI) until the offer is accepted or declined.
 */
export function isOfferPending(state: GameState): boolean {
  return state.drawOffer != null || state.takebackOffer != null;
}

/** Look up the side a player is on, or null if they're not playing. */
export function sideOf(state: GameState, userId: string): Side | null {
  if (state.red.userId === userId) return "red";
  if (state.black.userId === userId) return "black";
  return null;
}

export function playerOnSide(state: GameState, side: Side): PlayerRef {
  return side === "red" ? state.red : state.black;
}
