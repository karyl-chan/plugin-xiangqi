import type { ComponentContext, ComponentReply } from "@karyl-chan/plugin-sdk";
import { EMBED_COLOR } from "../constants.js";
import { t, sideLabel, resolveLocale } from "../i18n/index.js";
import {
  getGame,
  removeGame,
  setGame,
  withChannelLock,
} from "../game/store.js";
import {
  buildPendingGame,
  type GameState,
  type PlayerRef,
} from "../game/state.js";
import { notifyGameChanged } from "./sse.js";
import { ephemeralFollowup, sendMessage } from "./discord.js";
import { BOARD_TOP_RULE, renderBoardText } from "../game/render.js";
import { startClockTicker } from "./clock.js";
import { cancelAiStep, scheduleAiStep } from "../engine/npc-driver.js";
import { buildWebuiLinkRow } from "./webui-link.js";
import {
  getOpenInvite,
  removeOpenInvite,
  type OpenInvite,
} from "./invite-store.js";
import { otherSide, type Side } from "../xiangqi/pieces.js";

/**
 * Move a game from `pending_accept` into `active`: stamp acceptance,
 * post the initial board, kick off the AI / clock, and notify any
 * WebUI subscribers.
 */
export async function startActiveGame(state: GameState): Promise<void> {
  state.status = "active";
  state.acceptedAt = Date.now();
  if (state.clock) state.clock.turnStartedAt = state.acceptedAt;

  let sent: { id: string; channel_id: string } | null = null;
  if (state.showBoard) {
    sent = await sendMessage({
      channelId: state.channelId,
      embeds: [
        {
          title: t(state.locale, "board.title", { shortId: state.sessionId.slice(0, 6) }),
          color: EMBED_COLOR,
          description: [
            t(state.locale, "board.vsLine", {
              red: state.red.displayName,
              black: state.black.displayName,
            }),
            t(state.locale, "board.turnNote", {
              side: sideLabel(state.locale, state.board.sideToMove),
            }),
            BOARD_TOP_RULE,
            "```",
            renderBoardText(state.board),
            "```",
          ].join("\n"),
        },
      ],
    });
  } else {
    // Blind-mode: just a one-liner so the channel knows the game opened.
    sent = await sendMessage({
      channelId: state.channelId,
      content: t(state.locale, "board.openLine", {
        red: state.red.displayName,
        black: state.black.displayName,
        side: sideLabel(state.locale, state.board.sideToMove),
      }),
    });
  }
  if (sent) state.lastBoardMessageId = sent.id;

  if (state.clock) {
    startClockTicker(state, () => {
      /* end-of-game banner is posted by clock module via notify+retain */
    });
  }

  notifyGameChanged(state.channelId);

  const stm = state.board.sideToMove === "red" ? state.red : state.black;
  if (stm.kind === "ai") scheduleAiStep(state);
}

// ── direct invite buttons ─────────────────────────────────────────────────

function inviteeIdOf(g: GameState): string {
  return g.red.userId === g.challengerUserId ? g.black.userId : g.red.userId;
}

export async function handleAcceptButton(
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
    if (!game || game.sessionId !== sessionId) {
      await ephemeralFollowup(ctx, t(ctxLocale, "invite.cancelled"));
      return;
    }
    if (game.status !== "pending_accept") {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.pendingNotMatch"));
      return;
    }
    if (ctx.userId !== inviteeIdOf(game)) {
      // Anyone other than the named invitee gets an ephemeral "no perm";
      // the invite stays intact for the real opponent.
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    await startActiveGame(game);
    const linkRow = await buildWebuiLinkRow({
      userId: ctx.userId,
      guildId: game.guildId,
      channelId,
      sessionId: game.sessionId,
      locale: ctxLocale,
    });
    return {
      content: t(game.locale, "invite.joined", {
        opponent: ctx.userDisplayName ?? ctx.userId,
        side: sideLabel(
          game.locale,
          game.red.userId === ctx.userId ? "red" : "black",
        ),
      }),
      components: linkRow ? [linkRow] : [],
    };
  });
}

export async function handleDeclineButton(
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
    if (!game || game.sessionId !== sessionId) {
      await ephemeralFollowup(ctx, t(ctxLocale, "invite.cancelled"));
      return;
    }
    if (game.status !== "pending_accept") {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.pendingNotMatch"));
      return;
    }
    if (ctx.userId !== inviteeIdOf(game)) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    removeGame(channelId);
    cancelAiStep(game.sessionId);
    notifyGameChanged(channelId);
    return {
      content: t(game.locale, "invite.declined", {
        opponent: ctx.userDisplayName ?? ctx.userId,
      }),
      components: [],
    };
  });
}

/** Cancel — challenger-only. Works on a pending direct invite. */
export async function handleCancelDirectButton(
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
    if (!game || game.sessionId !== sessionId) {
      await ephemeralFollowup(ctx, t(ctxLocale, "invite.cancelled"));
      return;
    }
    if (game.status !== "pending_accept") {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.pendingNotMatch"));
      return;
    }
    if (ctx.userId !== game.challengerUserId) {
      await ephemeralFollowup(ctx, t(ctxLocale, "invite.cantCancelOther"));
      return;
    }
    removeGame(channelId);
    cancelAiStep(game.sessionId);
    notifyGameChanged(channelId);
    return { content: t(game.locale, "invite.cancelled"), components: [] };
  });
}

// ── public invite buttons ─────────────────────────────────────────────────

async function joinPublic(
  ctx: ComponentContext,
  inviteId: string,
  joinerSide: Side,
): Promise<ComponentReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) {
    await ephemeralFollowup(ctx, t(ctxLocale, "error.notInGuild"));
    return;
  }
  return withChannelLock(channelId, async () => {
    const invite = getOpenInvite(channelId);
    if (!invite || invite.inviteId !== inviteId) {
      await ephemeralFollowup(ctx, t(ctxLocale, "invite.cancelled"));
      return;
    }
    if (ctx.userId === invite.challengerUserId) {
      await ephemeralFollowup(ctx, t(ctxLocale, "invite.cantJoinOwn"));
      return;
    }
    if (invite.challengerSide && joinerSide === invite.challengerSide) {
      // Challenger pinned this side; this button shouldn't exist, but
      // be defensive in case Discord shows a stale message.
      await ephemeralFollowup(ctx, t(ctxLocale, "error.noPermission"));
      return;
    }
    if (getGame(channelId)) {
      await ephemeralFollowup(ctx, t(ctxLocale, "error.alreadyRunning"));
      return;
    }
    return promoteInviteToGame(ctx, invite, joinerSide);
  });
}

async function promoteInviteToGame(
  ctx: ComponentContext,
  invite: OpenInvite,
  joinerSide: Side,
): Promise<ComponentReply> {
  const ctxLocale = resolveLocale(ctx);
  const challenger: PlayerRef = {
    userId: invite.challengerUserId,
    displayName: invite.challengerDisplayName,
    kind: "human",
  };
  const joiner: PlayerRef = {
    userId: ctx.userId,
    displayName: ctx.userDisplayName ?? ctx.userId,
    kind: "human",
  };
  const challengerPlaysSide: Side = otherSide(joinerSide);
  const game = buildPendingGame({
    channelId: invite.channelId,
    guildId: invite.guildId,
    challenger,
    invitee: joiner,
    challengerPlaysSide,
    clock: invite.clock,
    showBoard: invite.showBoard,
    locale: invite.locale,
  });
  setGame(invite.channelId, game);
  removeOpenInvite(invite.channelId);
  await startActiveGame(game);

  const linkRow = await buildWebuiLinkRow({
    userId: ctx.userId,
    guildId: invite.guildId,
    channelId: invite.channelId,
    sessionId: game.sessionId,
    locale: ctxLocale,
  });
  return {
    content: t(game.locale, "invite.joined", {
      opponent: joiner.displayName,
      side: sideLabel(game.locale, joinerSide),
    }),
    components: linkRow ? [linkRow] : [],
  };
}

export async function handleJoinRedButton(
  ctx: ComponentContext,
  inviteId: string,
): Promise<ComponentReply> {
  return joinPublic(ctx, inviteId, "red");
}

export async function handleJoinBlackButton(
  ctx: ComponentContext,
  inviteId: string,
): Promise<ComponentReply> {
  return joinPublic(ctx, inviteId, "black");
}

export async function handleCancelOpenButton(
  ctx: ComponentContext,
  inviteId: string,
): Promise<ComponentReply> {
  const ctxLocale = resolveLocale(ctx);
  const channelId = ctx.channelId;
  if (!channelId) {
    await ephemeralFollowup(ctx, t(ctxLocale, "error.notInGuild"));
    return;
  }
  return withChannelLock(channelId, async () => {
    const invite = getOpenInvite(channelId);
    if (!invite || invite.inviteId !== inviteId) {
      await ephemeralFollowup(ctx, t(ctxLocale, "invite.cancelled"));
      return;
    }
    if (ctx.userId !== invite.challengerUserId) {
      await ephemeralFollowup(ctx, t(ctxLocale, "invite.cantCancelOther"));
      return;
    }
    removeOpenInvite(channelId);
    return { content: t(invite.locale, "invite.cancelled"), components: [] };
  });
}
