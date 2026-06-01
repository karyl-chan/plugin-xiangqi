import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { t, sideLabel, resolveLocale } from "../i18n/index.js";
import {
  getGame,
  retainEndedGame,
  withChannelLock,
} from "../game/store.js";
import { sideOf, type GameState } from "../game/state.js";
import { otherSide, type Side } from "../xiangqi/pieces.js";
import { notifyGameChanged } from "./sse.js";
import { sendMessage, deleteMessage } from "./discord.js";
import { stopClockTicker } from "./clock.js";
import { cancelAiStep } from "../engine/npc-driver.js";

/**
 * Drop any pending draw/takeback offer when the game ends another way
 * (e.g. resign), deleting the now-stale actionable post so its buttons
 * can't be clicked after the game is over.
 */
async function clearPendingOffers(game: GameState): Promise<void> {
  const ids = [game.drawOffer?.messageId, game.takebackOffer?.messageId];
  game.drawOffer = undefined;
  game.takebackOffer = undefined;
  for (const id of ids) {
    if (id) await deleteMessage({ channelId: game.channelId, messageId: id });
  }
}

/**
 * Apply the resign mutation + side effects (clock stop, AI cancel,
 * retain-ended bucket, SSE notify, channel banner). Both the Discord
 * /xiangqi resign command and the WebUI `resign` action call this so the
 * two interfaces produce identical state and channel posts. The caller
 * is responsible for holding the channel lock.
 */
export async function applyResignBySide(
  game: GameState,
  side: Side,
): Promise<void> {
  await clearPendingOffers(game);
  const winnerSide = otherSide(side);
  game.status = winnerSide === "red" ? "red_win" : "black_win";
  game.result = { winner: winnerSide, reason: "resign", at: Date.now() };
  game.endedAt = Date.now();
  stopClockTicker(game.sessionId);
  cancelAiStep(game.sessionId);
  retainEndedGame(game);
  notifyGameChanged(game.channelId);

  await sendMessage({
    channelId: game.channelId,
    embeds: [
      {
        title: t(game.locale, "board.gameOver"),
        description: [
          t(game.locale, "end.resign", { side: sideLabel(game.locale, side) }),
          winnerSide === "red"
            ? t(game.locale, "end.winnerRed")
            : t(game.locale, "end.winnerBlack"),
        ].join("\n"),
      },
    ],
  });
}

export async function handleResign(ctx: CommandContext): Promise<CommandReply> {
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
    await applyResignBySide(game, side);
    return {
      content: t(ctxLocale, "end.resign", {
        side: sideLabel(ctxLocale, side),
      }),
    };
  });
}
