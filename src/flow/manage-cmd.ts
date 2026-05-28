import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t, resolveLocale } from "../i18n/index.js";
import { runtime } from "../runtime.js";
import { linkButtonRow } from "./discord.js";

export async function handleManage(ctx: CommandContext): Promise<CommandReply> {
  const locale = resolveLocale(ctx);
  const res = (await runtime().botRpc("/api/plugin/auth.session", {
    user_id: ctx.userId,
    kind: "manage",
  })) as { allowed?: boolean; token?: string } | null;
  if (res === null) {
    return { content: `⚠ ${t(locale, "manage.botRejected")}`, ephemeral: true };
  }
  if (res.allowed !== true || typeof res.token !== "string") {
    return { content: `⚠ ${t(locale, "manage.notAllowed")}`, ephemeral: true };
  }
  const base = runtime().publicBaseUrl();
  if (!base) {
    return { content: t(locale, "manage.publicBaseUrlMissing"), ephemeral: true };
  }
  const url = `${base.replace(/\/+$/, "")}/?token=${res.token}&mode=manage`;
  return {
    content: `🛠 **${t(locale, "manage.title")}**\n${t(locale, "manage.description")}`,
    // `manage.openButton` already contains the icon prefix — don't double it.
    components: [linkButtonRow(t(locale, "manage.openButton"), url)],
    ephemeral: true,
  };
}
