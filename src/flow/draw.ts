import type {
  CommandContext,
  CommandReply,
  ComponentContext,
  ComponentReply,
} from "@karyl-chan/plugin-sdk";
import { t, sideLabel, resolveLocale } from "../i18n/index.js";
import {
  getGame,
  retainEndedGame,
  withChannelLock,
} from "../game/store.js";
import { sideOf, type GameState } from "../game/state.js";
import { type Side } from "../xiangqi/pieces.js";
import { notifyGameChanged } from "./sse.js";
import { sendMessage, buttonRow, buildCustomId, ephemeralFollowup } from "./discord.js";
import { stopClockTicker } from "./clock.js";
import { cancelAiStep } from "../engine/npc-driver.js";

export type DrawOfferResult = "offered" | "vs_ai_declined";

/**
 * Pure helpers shared by Discord + WebUI. The caller holds the channel
 * lock and has already validated that the actor is a player on the
 * given side. The Discord post still carries Discord-side buttons; WebUI
 * users see and respond to the same offer via the snapshot's
 * `drawOffer` field.
 */
export async function applyOfferDrawBySide(
  game: GameState,
  side: Side,
): Promise<DrawOfferResult> {
  const opponent = side === "red" ? game.black : game.red;
  if (opponent.kind === "ai") return "vs_ai_declined";
  game.drawOffer = { from: side, at: Date.now() };
  notifyGameChanged(game.channelId);
  await sendMessage({
    channelId: game.channelId,
    content: t(game.locale, "draw.offered", {
      side: sideLabel(game.locale, side),
    }),
    components: [
      buttonRow([
        {
          label: t(game.locale, "draw.acceptBtn"),
          customId: buildCustomId("draw-acc", game.sessionId),
          style: 3,
        },
        {
          label: t(game.locale, "draw.declineBtn"),
          customId: buildCustomId("draw-dec", game.sessionId),
          style: 4,
        },
      ]),
    ],
  });
  return "offered";
}

export async function applyAcceptDrawBySide(game: GameState): Promise<void> {
  game.status = "draw";
  game.result = { reason: "draw_agreed", at: Date.now() };
  game.endedAt = Date.now();
  game.drawOffer = undefined;
  stopClockTicker(game.sessionId);
  cancelAiStep(game.sessionId);
  retainEndedGame(game);
  notifyGameChanged(game.channelId);
  await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        title: t(game.locale, "board.gameOver"),
        description: t(game.locale, "end.drawAgreed"),
      },
    ],
  });
}

export function applyDeclineDrawBySide(game: GameState): void {
  game.drawOffer = undefined;
  notifyGameChanged(game.channelId);
}

export async function handleDraw(ctx: CommandContext): Promise<CommandReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) return t(ctxLocale, "error.notInGuild");
  return withChannelLock(channelId, async () => {
    const game = getGame(channelId);
    if (!game || game.status !== "active") {
      return { content: t(ctxLocale, "error.noGame"), ephemeral: true };
    }
    const side = sideOf(game, ctx.userId);
    if (!side) {
      return { content: t(ctxLocale, "error.notPlayer"), ephemeral: true };
    }
    const result = await applyOfferDrawBySide(game, side);
    if (result === "vs_ai_declined") {
      return { content: t(ctxLocale, "draw.declined"), ephemeral: true };
    }
    return {
      content: t(ctxLocale, "draw.offered", {
        side: sideLabel(ctxLocale, side),
      }),
      ephemeral: true,
    };
  });
}

export async function handleDrawAcceptButton(
  ctx: ComponentContext,
  sessionId: string,
): Promise<ComponentReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) {
    await ephemeralFollowup(ctx, t(ctxLocale, "error.notInGuild"));
    return;
  }
  return withChannelLock(channelId, async () => {
    const game = getGame(channelId);
    if (!game || game.sessionId !== sessionId || !game.drawOffer) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noGame"));
      return;
    }
    const side = sideOf(game, ctx.userId);
    if (!side || side === game.drawOffer.from) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    await applyAcceptDrawBySide(game);
    return { content: t(game.locale, "end.drawAgreed"), components: [] };
  });
}

export async function handleDrawDeclineButton(
  ctx: ComponentContext,
  sessionId: string,
): Promise<ComponentReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) {
    await ephemeralFollowup(ctx, t(ctxLocale, "error.notInGuild"));
    return;
  }
  return withChannelLock(channelId, async () => {
    const game = getGame(channelId);
    if (!game || game.sessionId !== sessionId || !game.drawOffer) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noGame"));
      return;
    }
    const side = sideOf(game, ctx.userId);
    if (!side || side === game.drawOffer.from) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    applyDeclineDrawBySide(game);
    return { content: t(game.locale, "draw.declined"), components: [] };
  });
}
