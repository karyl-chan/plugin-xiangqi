import { runtime } from "../runtime.js";
import { t } from "../i18n/index.js";
import { linkButtonRow } from "./discord.js";

/**
 * Mint a per-user plugin-session JWT (Ed25519, signed by the bot) and
 * assemble the link-button row for opening the WebUI board pinned to
 * this game instance.
 *
 * Returns null when the bot declines (RPC not allowed, plugin disabled
 * mid-game, etc.).
 */
export async function buildWebuiLinkRow(opts: {
  userId: string;
  guildId: string;
  channelId: string;
  sessionId: string;
}): Promise<unknown | null> {
  const res = (await runtime().botRpc("/api/plugin/auth.session", {
    user_id: opts.userId,
    kind: "session",
    guild_id: opts.guildId,
  })) as { allowed?: boolean; token?: string } | null;
  if (res?.allowed !== true || typeof res.token !== "string") return null;
  const base = runtime().publicBaseUrl();
  if (!base) return null;
  const url = `${base.replace(/\/+$/, "")}/?token=${res.token}&c=${opts.channelId}&s=${opts.sessionId}`;
  // `webui.openButton` already contains the icon prefix — don't double it.
  return linkButtonRow(t(undefined, "webui.openButton"), url);
}
