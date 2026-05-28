import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t, resolveLocale } from "../i18n/index.js";
import { getEndedGame, getGame } from "../game/store.js";
import { sideOf } from "../game/state.js";
import { buildWebuiLinkRow } from "./webui-link.js";

export async function handleWebui(ctx: CommandContext): Promise<CommandReply> {
  const locale = resolveLocale(ctx);
  const guildId = ctx.guildId;
  const channelId = ctx.channelId;
  if (!guildId || !channelId) return t(locale, "error.notInGuild");
  const game = getGame(channelId) ?? getEndedGame(channelId);
  if (!game) return { content: t(locale, "error.noGame"), ephemeral: true };

  const linkRow = await buildWebuiLinkRow({
    userId: ctx.userId,
    guildId,
    channelId,
    sessionId: game.sessionId,
    locale,
  });
  if (!linkRow) {
    return { content: t(locale, "webui.unavailable"), ephemeral: true };
  }
  const isPlayer = sideOf(game, ctx.userId) !== null;
  const intro = isPlayer
    ? t(locale, "webui.descriptionPlayer")
    : t(locale, "webui.descriptionSpectator");
  return {
    content: `🎯 **${t(locale, "webui.title")}**\n${intro}`,
    components: [linkRow],
    ephemeral: true,
  };
}
