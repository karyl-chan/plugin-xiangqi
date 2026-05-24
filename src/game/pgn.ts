import type { GameState } from "./state.js";

/**
 * Produce a plain-text move log suitable for copy-paste / archiving.
 * Each pair of half-moves is rendered as
 *
 *   1. 炮二平五 (h2e2)    馬8進7 (b7c5)
 *
 * The output starts with a short header summarising who played and the
 * final result, followed by the move list. The format is intentionally
 * informal — it is not standard PGN (Xiangqi doesn't really have a
 * standard PGN), just a Discord-friendly transcript.
 */
export function renderMoveLog(state: GameState): string {
  const lines: string[] = [];
  lines.push(
    `Karyl Xiangqi — ${state.red.displayName} (紅) vs ${state.black.displayName} (黑)`,
  );
  if (state.result) {
    const winner = state.result.winner;
    const label =
      winner === "red"
        ? "紅方勝"
        : winner === "black"
          ? "黑方勝"
          : "和棋";
    lines.push(`${label} — ${state.result.reason}`);
  } else if (state.status === "active") {
    lines.push("(對局進行中)");
  } else {
    lines.push(`(${state.status})`);
  }
  lines.push("");

  for (let i = 0; i < state.history.length; i += 2) {
    const moveNo = i / 2 + 1;
    const redMove = state.history[i];
    const blackMove = state.history[i + 1];
    const redCol = redMove ? redMove.combined : "";
    const blackCol = blackMove ? blackMove.combined : "";
    lines.push(`${String(moveNo).padStart(3)}.  ${redCol.padEnd(22)}${blackCol}`);
  }
  return lines.join("\n");
}
