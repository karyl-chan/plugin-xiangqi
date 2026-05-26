import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t, sideZh } from "../i18n/index.js";
import { getEndedGame, getGame } from "../game/store.js";
import { BOARD_TOP_RULE, renderBoardText } from "../game/render.js";
import { EMBED_COLOR } from "../constants.js";

export async function handleBoard(ctx: CommandContext): Promise<CommandReply> {
  const channelId = ctx.channelId;
  if (!channelId) return t(undefined, "error.notInGuild");
  const game = getGame(channelId) ?? getEndedGame(channelId);
  if (!game) return { content: t(undefined, "error.noGame"), ephemeral: true };

  const embed = {
    title: t(undefined, "board.title", { shortId: game.sessionId.slice(0, 6) }),
    color: EMBED_COLOR,
    description: [
      `${game.red.displayName} (紅) vs ${game.black.displayName} (黑)`,
      game.status === "active"
        ? t(undefined, "board.turnNote", { sideZh: sideZh(game.board.sideToMove) })
        : t(undefined, "board.gameOver"),
      BOARD_TOP_RULE,
      "```",
      renderBoardText(game.board),
      "```",
    ].join("\n"),
  };
  return { embeds: [embed], ephemeral: true };
}
