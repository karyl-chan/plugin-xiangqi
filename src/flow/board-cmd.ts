import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t, sideLabel, resolveLocale } from "../i18n/index.js";
import { getEndedGame, getGame } from "../game/store.js";
import { BOARD_TOP_RULE, renderBoardText } from "../game/render.js";
import { EMBED_COLOR } from "../constants.js";

export async function handleBoard(ctx: CommandContext): Promise<CommandReply> {
  const locale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) return t(locale, "error.notInGuild");
  const game = getGame(channelId) ?? getEndedGame(channelId);
  if (!game) return { content: t(locale, "error.noGame"), ephemeral: true };

  const embed = {
    title: t(locale, "board.title", { shortId: game.sessionId.slice(0, 6) }),
    color: EMBED_COLOR,
    description: [
      t(locale, "board.vsLine", {
        red: game.red.displayName,
        black: game.black.displayName,
      }),
      game.status === "active"
        ? t(locale, "board.turnNote", {
            side: sideLabel(locale, game.board.sideToMove),
          })
        : t(locale, "board.gameOver"),
      BOARD_TOP_RULE,
      "```",
      renderBoardText(game.board),
      "```",
    ].join("\n"),
  };
  return { embeds: [embed], ephemeral: true };
}
