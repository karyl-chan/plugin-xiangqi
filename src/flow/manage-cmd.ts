import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t } from "../i18n/index.js";
import { runtime } from "../runtime.js";
import { linkButtonRow } from "./discord.js";

export async function handleManage(ctx: CommandContext): Promise<CommandReply> {
  const res = (await runtime().botRpc("/api/plugin/auth.session", {
    user_id: ctx.userId,
    kind: "manage",
  })) as { allowed?: boolean; token?: string } | null;
  if (res === null) {
    return { content: `⚠ ${t(undefined, "manage.botRejected")}`, ephemeral: true };
  }
  if (res.allowed !== true || typeof res.token !== "string") {
    return { content: `⚠ ${t(undefined, "manage.notAllowed")}`, ephemeral: true };
  }
  const base = runtime().publicBaseUrl();
  if (!base) {
    return { content: "⚠ publicBaseUrl 尚未可用", ephemeral: true };
  }
  const url = `${base.replace(/\/+$/, "")}/?token=${res.token}&mode=manage`;
  return {
    content: `🛠 **${t(undefined, "manage.title")}**\n${t(undefined, "manage.description")}`,
    components: [linkButtonRow(`🛠 ${t(undefined, "manage.openButton")}`, url)],
    ephemeral: true,
  };
}
