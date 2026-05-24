import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t } from "../i18n/index.js";
import { getGame, removeGame, withChannelLock } from "../game/store.js";
import { sideOf } from "../game/state.js";
import { notifyGameChanged } from "./sse.js";
import { stopClockTicker } from "./clock.js";
import { cancelAiStep } from "../engine/npc-driver.js";
import { getOpenInvite, removeOpenInvite } from "./invite-store.js";

export async function handleStop(ctx: CommandContext): Promise<CommandReply> {
  const channelId = ctx.channelId;
  if (!channelId) return t(undefined, "error.notInGuild");
  return withChannelLock(channelId, async () => {
    const isAdmin = ctx.hasCapability?.("admin") === true;

    // Pending public invite gets cancelled here too — same gate as the
    // cancel button: challenger-only (or admin override).
    const invite = getOpenInvite(channelId);
    if (invite) {
      if (ctx.userId !== invite.challengerUserId && !isAdmin) {
        return { content: t(undefined, "invite.cantCancelOther"), ephemeral: true };
      }
      removeOpenInvite(channelId);
      return { content: t(undefined, "invite.cancelled") };
    }

    const game = getGame(channelId);
    if (!game) return { content: t(undefined, "error.noGame"), ephemeral: true };
    const isPlayer = sideOf(game, ctx.userId) !== null;
    const isChallenger = game.challengerUserId === ctx.userId;
    if (!isPlayer && !isChallenger && !isAdmin) {
      return { content: t(undefined, "error.noPermission"), ephemeral: true };
    }
    game.status = "aborted";
    game.result = { reason: "aborted", at: Date.now() };
    game.endedAt = Date.now();
    stopClockTicker(game.sessionId);
    cancelAiStep(game.sessionId);
    removeGame(channelId);                // force-stop: do NOT retain
    notifyGameChanged(channelId);
    return { content: t(undefined, "end.aborted") };
  });
}
