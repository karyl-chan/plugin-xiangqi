import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t } from "../i18n/index.js";
import { getEndedGame, getGame } from "../game/store.js";
import { renderMoveLog } from "../game/pgn.js";

export async function handlePgn(ctx: CommandContext): Promise<CommandReply> {
  const channelId = ctx.channelId;
  if (!channelId) return t(undefined, "error.notInGuild");
  const game = getGame(channelId) ?? getEndedGame(channelId);
  if (!game) return { content: t(undefined, "error.noGame"), ephemeral: true };
  const text = renderMoveLog(game);
  return {
    content: "```\n" + text + "\n```",
    ephemeral: true,
  };
}
