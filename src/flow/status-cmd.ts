import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t, sideZh } from "../i18n/index.js";
import { getEndedGame, getGame } from "../game/store.js";
import { formatClockMs } from "./clock.js";
import { EMBED_COLOR } from "../constants.js";

export async function handleStatus(ctx: CommandContext): Promise<CommandReply> {
  const channelId = ctx.channelId;
  if (!channelId) return t(undefined, "error.notInGuild");
  const game = getGame(channelId) ?? getEndedGame(channelId);
  if (!game) return { content: t(undefined, "error.noGame"), ephemeral: true };

  const lines: string[] = [];
  lines.push(`${game.red.displayName} (紅) vs ${game.black.displayName} (黑)`);
  lines.push(t(undefined, "status.movesPlayed", { n: game.history.length }));
  if (game.status === "active") {
    lines.push(t(undefined, "board.turnNote", { sideZh: sideZh(game.board.sideToMove) }));
  }
  if (game.clock) {
    lines.push(
      t(undefined, "status.clock", {
        red: formatClockMs(game.clock.redRemainingMs),
        black: formatClockMs(game.clock.blackRemainingMs),
      }),
    );
  } else {
    lines.push(t(undefined, "status.clockOff"));
  }
  if (game.result) {
    if (game.result.winner === "red") lines.push(t(undefined, "end.winnerRed"));
    else if (game.result.winner === "black") lines.push(t(undefined, "end.winnerBlack"));
    else lines.push(t(undefined, "end.draw"));
  }

  const embed = {
    title: t(undefined, "board.title", { shortId: game.sessionId.slice(0, 6) }),
    color: EMBED_COLOR,
    description: lines.join("\n"),
  };
  return { embeds: [embed], ephemeral: true };
}
