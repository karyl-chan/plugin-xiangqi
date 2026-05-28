import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t, sideLabel, resolveLocale } from "../i18n/index.js";
import { getEndedGame, getGame } from "../game/store.js";
import { formatClockMs } from "./clock.js";
import { EMBED_COLOR } from "../constants.js";

export async function handleStatus(ctx: CommandContext): Promise<CommandReply> {
  const locale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) return t(locale, "error.notInGuild");
  const game = getGame(channelId) ?? getEndedGame(channelId);
  if (!game) return { content: t(locale, "error.noGame"), ephemeral: true };

  const lines: string[] = [];
  lines.push(
    t(locale, "board.vsLine", {
      red: game.red.displayName,
      black: game.black.displayName,
    }),
  );
  lines.push(t(locale, "status.movesPlayed", { n: game.history.length }));
  if (game.status === "active") {
    lines.push(
      t(locale, "board.turnNote", {
        side: sideLabel(locale, game.board.sideToMove),
      }),
    );
  }
  if (game.clock) {
    lines.push(
      t(locale, "status.clock", {
        red: formatClockMs(game.clock.redRemainingMs),
        black: formatClockMs(game.clock.blackRemainingMs),
      }),
    );
  } else {
    lines.push(t(locale, "status.clockOff"));
  }
  if (game.result) {
    if (game.result.winner === "red") lines.push(t(locale, "end.winnerRed"));
    else if (game.result.winner === "black") lines.push(t(locale, "end.winnerBlack"));
    else lines.push(t(locale, "end.draw"));
  }

  const embed = {
    title: t(locale, "board.title", { shortId: game.sessionId.slice(0, 6) }),
    color: EMBED_COLOR,
    description: lines.join("\n"),
  };
  return { embeds: [embed], ephemeral: true };
}
