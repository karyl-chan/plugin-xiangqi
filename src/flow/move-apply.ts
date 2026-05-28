import {
  EMBED_COLOR,
  EMBED_COLOR_DRAW,
  EMBED_COLOR_WIN,
} from "../constants.js";
import { applyMove as boardApplyMove } from "../xiangqi/moves.js";
import { allLegalMoves, isInCheck } from "../xiangqi/rules.js";
import { evaluatePosition, isThreefoldRepetition } from "../xiangqi/result.js";
import { toChineseAndIccs } from "../xiangqi/notation/format.js";
import { type Side } from "../xiangqi/pieces.js";
import { type Square } from "../xiangqi/board.js";
import {
  positionKey,
  type EndReason,
  type GameState,
  type MoveRecord,
} from "../game/state.js";
import { retainEndedGame } from "../game/store.js";
import { BOARD_TOP_RULE, renderBoardText } from "../game/render.js";
import { sendMessage } from "./discord.js";
import { notifyGameChanged } from "./sse.js";
import { cancelAiStep } from "../engine/npc-driver.js";
import { t, sideLabel } from "../i18n/index.js";

/**
 * THE move chokepoint. Both the channel-message watcher and the WebUI
 * POST /api/game/action route call this with `source` set appropriately.
 *
 * Responsibilities:
 *   1. Verify it's the user's turn (callers should also pre-check, but
 *      we double-check defensively).
 *   2. Format the move (Chinese + ICCS) BEFORE applying — the formatter
 *      reads the pre-move board.
 *   3. Apply on the board.
 *   4. Stamp a MoveRecord with side, fromTo, formatted, source.
 *   5. Detect end-of-game (checkmate / stalemate / 60-move / repetition)
 *      and finalise.
 *   6. Echo to the channel for source ∈ {webui, ai}; not for channel-message.
 *   7. Notify SSE subscribers.
 *
 * The state object is mutated in place. `clock` adjustments are handled
 * by the optional clock module's hook (passed in via `onClockTick`) —
 * leaving it null means no clock tracking.
 */

export interface ApplyOutcome {
  record: MoveRecord;
  ended: boolean;
  endReason?: EndReason;
  winner?: Side | null;
  /** True if the OPPONENT (post-move side-to-move) is now in check. */
  givesCheck: boolean;
}

export interface ApplyOptions {
  source: MoveRecord["source"];
  /** Wallclock ms for the move; defaults to Date.now(). */
  at?: number;
  /** Run after the move is committed but before SSE/echo. Lets the
   *  caller tick the clock / increment, knowing the post-move state. */
  onPostApply?: (state: GameState, record: MoveRecord) => void;
}

export async function applyMoveToGame(
  state: GameState,
  movingSide: Side,
  from: Square,
  to: Square,
  opts: ApplyOptions,
): Promise<ApplyOutcome> {
  if (state.status !== "active") {
    throw new Error(`applyMove: game not active (status=${state.status})`);
  }
  if (state.board.sideToMove !== movingSide) {
    throw new Error("applyMove: wrong side to move");
  }

  // Format BEFORE applying so the formatter sees the pre-move board.
  const formatted = toChineseAndIccs(state.board, from, to);

  const applied = boardApplyMove(state.board, from, to);

  const at = opts.at ?? Date.now();
  const record: MoveRecord = {
    side: movingSide,
    from,
    to,
    capturedFen: applied.captured
      ? `${applied.captured.side}/${applied.captured.kind}`
      : undefined,
    fenAfter: applied.fenAfter,
    formattedZh: formatted.zh,
    formattedIccs: formatted.iccs,
    combined: formatted.combined,
    source: opts.source,
    at,
  };
  state.history.push(record);
  state.positionKeys.push(positionKey(state.board));

  opts.onPostApply?.(state, record);

  // Evaluate end-of-game from the new side-to-move's perspective.
  const ev = evaluatePosition(state.board);
  let ended = false;
  let endReason: EndReason | undefined;
  let winner: Side | null = null;
  if (ev.reason === "checkmate") {
    ended = true;
    endReason = "checkmate";
    winner = ev.winner;
  } else if (ev.reason === "stalemate") {
    ended = true;
    endReason = "stalemate";
    winner = ev.winner;
  } else if (ev.reason === "halfmove_60") {
    ended = true;
    endReason = "halfmove_60";
    winner = null;
  } else if (isThreefoldRepetition(state.positionKeys)) {
    ended = true;
    endReason = "repetition";
    winner = null;
  }

  if (ended) {
    finaliseGame(state, endReason!, winner, at);
  }

  const givesCheck = !ended && isInCheck(state.board, state.board.sideToMove);
  await echoMoveIfNeeded(state, record, opts.source, ended, endReason, winner, givesCheck);
  notifyGameChanged(state.channelId);

  return { record, ended, endReason, winner, givesCheck };
}

function finaliseGame(
  state: GameState,
  reason: EndReason,
  winner: Side | null,
  at: number,
): void {
  if (reason === "halfmove_60" || reason === "repetition" || reason === "draw_agreed") {
    state.status = "draw";
  } else if (winner === "red") state.status = "red_win";
  else if (winner === "black") state.status = "black_win";
  else state.status = "draw";
  state.result = { winner: winner ?? undefined, reason, at };
  state.endedAt = at;
  // Engine is kept alive for the full game (no idle-kill during active
  // play). Shut it down here on natural end so we don't leak the process
  // until the 2-hour abandoned-game fallback fires.
  cancelAiStep(state.sessionId);
  retainEndedGame(state);
}

async function echoMoveIfNeeded(
  state: GameState,
  record: MoveRecord,
  source: MoveRecord["source"],
  ended: boolean,
  endReason: EndReason | undefined,
  winner: Side | null,
  givesCheck: boolean,
): Promise<void> {
  // Channel-message moves are visible in the channel by definition.
  // Don't double-post the move text. If the game ended, post the
  // end-of-game banner.
  if (source === "channel-message" && !ended) return;
  if (source === "channel-message" && ended) {
    await postEndBanner(state, endReason, winner);
    return;
  }

  // WebUI / AI moves get echoed. The form depends on showBoard:
  //   true  → rich embed with board snapshot, move number, side label
  //   false → plain text "<move notation>" — no embed, no session id,
  //           no move number; closer to blindfold-chess notation
  if (!state.showBoard) {
    await echoBlindMove(state, record, ended, endReason, winner, givesCheck);
    return;
  }
  await echoRichMove(state, record, ended, endReason, winner, givesCheck);
}

async function echoBlindMove(
  state: GameState,
  record: MoveRecord,
  ended: boolean,
  endReason: EndReason | undefined,
  winner: Side | null,
  givesCheck: boolean,
): Promise<void> {
  const lines = [record.combined];
  if (givesCheck) lines.push(t(state.locale, "board.checkSuffix"));
  const sent = await sendMessage({
    channelId: state.channelId,
    content: lines.join("\n"),
  });
  if (sent) {
    record.echoMessageId = sent.id;
    state.lastBoardMessageId = sent.id;
  }
  if (ended) await postEndBanner(state, endReason, winner);
}

async function echoRichMove(
  state: GameState,
  record: MoveRecord,
  ended: boolean,
  endReason: EndReason | undefined,
  winner: Side | null,
  givesCheck: boolean,
): Promise<void> {
  const moveNo = state.history.length;
  const moveLine = t(state.locale, "board.move", {
    n: moveNo,
    side: sideLabel(state.locale, record.side),
    move: record.combined,
  });
  const lines: string[] = [moveLine];
  if (givesCheck) lines.push(t(state.locale, "board.checkSuffix"));
  if (ended) {
    if (winner === "red") lines.push(t(state.locale, "end.winnerRed"));
    else if (winner === "black") lines.push(t(state.locale, "end.winnerBlack"));
    else lines.push(t(state.locale, "end.draw"));
    lines.push(reasonText(state, endReason));
  }

  const embed: Record<string, unknown> = {
    title: t(state.locale, "board.title", { shortId: state.sessionId.slice(0, 6) }),
    color: ended
      ? winner == null
        ? EMBED_COLOR_DRAW
        : EMBED_COLOR_WIN
      : EMBED_COLOR,
    description: [
      ...lines,
      BOARD_TOP_RULE,
      "```",
      renderBoardText(state.board),
      "```",
    ].join("\n"),
  };

  const sent = await sendMessage({
    channelId: state.channelId,
    embeds: [embed],
  });
  if (sent) {
    record.echoMessageId = sent.id;
    state.lastBoardMessageId = sent.id;
  }
}

async function postEndBanner(
  state: GameState,
  endReason: EndReason | undefined,
  winner: Side | null,
): Promise<void> {
  const headline =
    winner === "red"
      ? t(state.locale, "end.winnerRed")
      : winner === "black"
        ? t(state.locale, "end.winnerBlack")
        : t(state.locale, "end.draw");
  const reason = reasonText(state, endReason);

  let sent: { id: string; channel_id: string } | null = null;
  if (state.showBoard) {
    sent = await sendMessage({
      channelId: state.channelId,
      embeds: [
        {
          title: t(state.locale, "board.gameOver"),
          color: winner == null ? EMBED_COLOR_DRAW : EMBED_COLOR_WIN,
          description: [
            headline,
            reason,
            BOARD_TOP_RULE,
            "```",
            renderBoardText(state.board),
            "```",
          ].join("\n"),
        },
      ],
    });
  } else {
    // Blind-mode: one plain line — still informative, but no embed/board.
    sent = await sendMessage({
      channelId: state.channelId,
      content: `${headline} — ${reason}`,
    });
  }
  if (sent) state.lastBoardMessageId = sent.id;
}

function reasonText(state: GameState, reason: EndReason | undefined): string {
  switch (reason) {
    case "checkmate":
      return t(state.locale, "end.checkmate");
    case "stalemate":
      // Stalemate end-reason — the side whose turn it is has no legal
      // moves. The end-of-game string benefits from naming them; pass an
      // empty `{side}` when we don't have it (callers that do not know
      // which side is stuck just get a cleanly-shaped string).
      return t(state.locale, "end.stalemate", { side: "" });
    case "resign":
      return t(state.locale, "end.resign", { side: "" });
    case "draw_agreed":
      return t(state.locale, "end.drawAgreed");
    case "timeout":
      return t(state.locale, "end.timeout", { side: "" });
    case "halfmove_60":
      return t(state.locale, "end.halfmove60");
    case "repetition":
      return t(state.locale, "end.repetition");
    case "aborted":
      return t(state.locale, "end.aborted");
    default:
      return "";
  }
}

/** Cheap util re-export so callers can decide before calling applyMoveToGame. */
export function isMoversTurn(state: GameState, side: Side): boolean {
  return state.status === "active" && state.board.sideToMove === side;
}

export function hasLegalMove(state: GameState, side: Side): boolean {
  return allLegalMoves(state.board, side).length > 0;
}
