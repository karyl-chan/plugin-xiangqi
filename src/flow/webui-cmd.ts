import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t } from "../i18n/index.js";
import { getEndedGame, getGame } from "../game/store.js";
import { sideOf } from "../game/state.js";
import { buildWebuiLinkRow } from "./webui-link.js";

export async function handleWebui(ctx: CommandContext): Promise<CommandReply> {
  const guildId = ctx.guildId;
  const channelId = ctx.channelId;
  if (!guildId || !channelId) return t(undefined, "error.notInGuild");
  const game = getGame(channelId) ?? getEndedGame(channelId);
  if (!game) return { content: t(undefined, "error.noGame"), ephemeral: true };

  const linkRow = await buildWebuiLinkRow({
    userId: ctx.userId,
    guildId,
    channelId,
    sessionId: game.sessionId,
  });
  if (!linkRow) {
    return { content: "⚠ 無法產生 WebUI 連結 (publicBaseUrl 或 RPC 不可用)", ephemeral: true };
  }
  const isPlayer = sideOf(game, ctx.userId) !== null;
  const intro = isPlayer
    ? t(undefined, "webui.descriptionPlayer")
    : t(undefined, "webui.descriptionSpectator");
  return {
    content: `🎯 **${t(undefined, "webui.title")}**\n${intro}`,
    components: [linkRow],
    ephemeral: true,
  };
}
