import type { CommandContext, CommandReply } from "@karyl-chan/plugin-sdk";
import { EMBED_COLOR } from "../constants.js";
import { t, sideLabel, resolveLocale, type Locale } from "../i18n/index.js";
import {
  buildPendingGame,
  type AiLevel,
  type PlayerRef,
} from "../game/state.js";
import {
  getGame,
  setGame,
  withChannelLock,
} from "../game/store.js";
import { type Side } from "../xiangqi/pieces.js";
import { parseClockOption } from "./clock.js";
import {
  buttonRow,
  buildCustomId,
  sendMessage,
} from "./discord.js";
import { startActiveGame } from "./accept.js";
import {
  getOpenInvite,
  newInviteId,
  setOpenInvite,
  type OpenInvite,
} from "./invite-store.js";

const AI_LEVELS: AiLevel[] = ["easy", "normal", "hard"];

/**
 * Handles `/xiangqi start`. Three modes, decided from options:
 *
 *   opponent        ai     →  mode
 *   ──────────────  ─────  ─────────────────────────────────────
 *   set             unset  →  direct invite (named opponent must accept)
 *   unset           set    →  AI game (auto-starts immediately)
 *   unset           unset  →  PUBLIC invite (anyone can join via button)
 *   set             set    →  AI wins (ai overrides opponent)
 *
 * `side` / `clock` options apply to all three modes. Every invite/AI
 * board also carries a [取消] button only the challenger can click.
 */
export async function handleStart(ctx: CommandContext): Promise<CommandReply> {
  const locale = resolveLocale(ctx);
  const guildId = ctx.guildId;
  const channelId = ctx.channelId;
  if (!guildId || !channelId) return t(locale, "error.notInGuild");

  // Reject if anything is already in flight in this channel.
  if (getGame(channelId)) return t(locale, "error.alreadyRunning");
  if (getOpenInvite(channelId)) return t(locale, "error.alreadyRunning");

  const opponentRaw = ctx.options.opponent as
    | { id: string; username?: string; global_name?: string | null; bot?: boolean }
    | undefined;
  const aiOpt = (ctx.options.ai as string | undefined)?.toLowerCase();
  const sideOpt = (ctx.options.side as string | undefined)?.toLowerCase() as
    | Side
    | undefined;
  const clockOpt = ctx.options.clock as string | undefined;

  let challengerSide: Side | null = null;
  if (sideOpt) {
    if (sideOpt !== "red" && sideOpt !== "black") {
      return { content: t(locale, "error.invalidSide"), ephemeral: true };
    }
    challengerSide = sideOpt;
  }

  let clockSpec: { baseSec: number; incSec: number } | null = null;
  if (clockOpt && clockOpt.trim().length > 0) {
    const parsed = parseClockOption(clockOpt);
    if (!parsed) {
      return { content: t(locale, "error.invalidClock"), ephemeral: true };
    }
    clockSpec = parsed;
  }

  const showBoard = ctx.options.show_board === true;

  const challenger: PlayerRef = {
    userId: ctx.userId,
    displayName: ctx.userDisplayName,
    kind: "human",
  };

  // — AI mode
  if (aiOpt) {
    if (!AI_LEVELS.includes(aiOpt as AiLevel)) {
      return { content: t(locale, "error.invalidAiLevel"), ephemeral: true };
    }
    return startAiGame(ctx, {
      guildId,
      channelId,
      challenger,
      challengerSide: challengerSide ?? "red",
      aiLevel: aiOpt as AiLevel,
      clockSpec,
      showBoard,
      locale,
    });
  }

  // — direct invite (named opponent)
  if (opponentRaw) {
    if (opponentRaw.bot)
      return { content: t(locale, "error.cantChallengeBot"), ephemeral: true };
    if (opponentRaw.id === ctx.userId)
      return { content: t(locale, "error.cantChallengeSelf"), ephemeral: true };
    return startDirectInvite(ctx, {
      guildId,
      channelId,
      challenger,
      challengerSide: challengerSide ?? "red",
      invitee: {
        userId: opponentRaw.id,
        displayName:
          opponentRaw.global_name ?? opponentRaw.username ?? opponentRaw.id,
        kind: "human",
      },
      clockSpec,
      showBoard,
      locale,
    });
  }

  // — public invite (anyone joins)
  return startPublicInvite(ctx, {
    guildId,
    channelId,
    challenger,
    challengerSide,
    clockSpec,
    showBoard,
    locale,
  });
}

// ── direct invite (named opponent) ────────────────────────────────────────

interface DirectInviteOpts {
  guildId: string;
  channelId: string;
  challenger: PlayerRef;
  challengerSide: Side;
  invitee: PlayerRef;
  clockSpec: { baseSec: number; incSec: number } | null;
  showBoard: boolean;
  locale: Locale;
}

async function startDirectInvite(
  _ctx: CommandContext,
  opts: DirectInviteOpts,
): Promise<CommandReply> {
  const { locale } = opts;
  const game = buildPendingGame({
    channelId: opts.channelId,
    guildId: opts.guildId,
    challenger: opts.challenger,
    invitee: opts.invitee,
    challengerPlaysSide: opts.challengerSide,
    clock: opts.clockSpec,
    showBoard: opts.showBoard,
    locale,
  });
  setGame(opts.channelId, game);

  const inviteEmbed = {
    title: t(locale, "invite.title", {
      challenger: opts.challenger.displayName,
      opponent: opts.invitee.displayName,
    }),
    description:
      (opts.challengerSide === "red"
        ? t(locale, "invite.descriptionRed", {
            challenger: opts.challenger.displayName,
            opponent: opts.invitee.displayName,
          })
        : t(locale, "invite.descriptionBlack", {
            challenger: opts.challenger.displayName,
            opponent: opts.invitee.displayName,
          })) +
      "\n" +
      t(locale, "invite.timeoutNote"),
    color: EMBED_COLOR,
  };
  const components = [
    buttonRow([
      {
        label: t(locale, "invite.acceptBtn"),
        customId: buildCustomId("acc", game.sessionId),
        style: 3,
      },
      {
        label: t(locale, "invite.declineBtn"),
        customId: buildCustomId("dec", game.sessionId),
        style: 4,
      },
      {
        label: t(locale, "invite.cancelBtn"),
        customId: buildCustomId("cancel", game.sessionId),
        style: 2,
      },
    ]),
  ];
  // Post via messages.send (CommandReply doesn't expose allowed_mentions,
  // and we want the invitee pinged).
  const sent = await sendMessage({
    channelId: opts.channelId,
    content: `<@${opts.invitee.userId}>`,
    embeds: [inviteEmbed],
    components,
    allowedMentions: { users: [opts.invitee.userId] },
  });
  if (sent) game.inviteMessageId = sent.id;
  return {
    content: t(locale, "invite.sentDirect", {
      opponent: opts.invitee.displayName,
    }),
    ephemeral: true,
  };
}

// ── public invite (open to anyone) ────────────────────────────────────────

interface PublicInviteOpts {
  guildId: string;
  channelId: string;
  challenger: PlayerRef;
  challengerSide: Side | null;  // null → opponent picks
  clockSpec: { baseSec: number; incSec: number } | null;
  showBoard: boolean;
  locale: Locale;
}

async function startPublicInvite(
  _ctx: CommandContext,
  opts: PublicInviteOpts,
): Promise<CommandReply> {
  const { locale } = opts;
  const invite: OpenInvite = {
    inviteId: newInviteId(),
    channelId: opts.channelId,
    guildId: opts.guildId,
    challengerUserId: opts.challenger.userId,
    challengerDisplayName: opts.challenger.displayName,
    challengerSide: opts.challengerSide,
    clock: opts.clockSpec,
    showBoard: opts.showBoard,
    locale,
    createdAt: Date.now(),
  };
  setOpenInvite(invite);

  const description = opts.challengerSide
    ? t(locale, "invite.publicDescriptionFixedSide", {
        challenger: opts.challenger.displayName,
        side: sideLabel(locale, opts.challengerSide),
      })
    : t(locale, "invite.publicDescriptionOpen", {
        challenger: opts.challenger.displayName,
      });
  const embed = {
    title: t(locale, "invite.publicTitle", {
      challenger: opts.challenger.displayName,
    }),
    description,
    color: EMBED_COLOR,
  };

  // Button layout depends on whether the challenger pre-picked a side.
  //   challenger picked RED → only [加入黑方] for joiners
  //   challenger picked BLACK → only [加入紅方]
  //   challenger let opponent choose → both [加入紅方][加入黑方]
  const joinBtns: Parameters<typeof buttonRow>[0] = [];
  if (opts.challengerSide !== "red") {
    joinBtns.push({
      label: t(locale, "invite.joinRedBtn"),
      customId: buildCustomId("join-r", invite.inviteId),
      style: 1,
    });
  }
  if (opts.challengerSide !== "black") {
    joinBtns.push({
      label: t(locale, "invite.joinBlackBtn"),
      customId: buildCustomId("join-b", invite.inviteId),
      style: 2,
    });
  }
  joinBtns.push({
    label: t(locale, "invite.cancelBtn"),
    customId: buildCustomId("inv-cancel", invite.inviteId),
    style: 4,
  });

  const sent = await sendMessage({
    channelId: opts.channelId,
    embeds: [embed],
    components: [buttonRow(joinBtns)],
  });
  if (sent) invite.inviteMessageId = sent.id;
  return {
    content: t(locale, "invite.publicCreated"),
    ephemeral: true,
  };
}

// ── AI ────────────────────────────────────────────────────────────────────

interface AiStartOpts {
  guildId: string;
  channelId: string;
  challenger: PlayerRef;
  challengerSide: Side;
  aiLevel: AiLevel;
  clockSpec: { baseSec: number; incSec: number } | null;
  showBoard: boolean;
  locale: Locale;
}

async function startAiGame(
  _ctx: CommandContext,
  opts: AiStartOpts,
): Promise<CommandReply> {
  const { locale } = opts;
  return withChannelLock(opts.channelId, async () => {
    if (getGame(opts.channelId)) return t(locale, "error.alreadyRunning");

    const ai: PlayerRef = {
      userId: `ai:${opts.aiLevel}`,
      displayName: `AI (${opts.aiLevel})`,
      kind: "ai",
      aiLevel: opts.aiLevel,
    };
    const game = buildPendingGame({
      channelId: opts.channelId,
      guildId: opts.guildId,
      challenger: opts.challenger,
      invitee: ai,
      challengerPlaysSide: opts.challengerSide,
      clock: opts.clockSpec,
      showBoard: opts.showBoard,
      locale,
    });
    setGame(opts.channelId, game);
    await startActiveGame(game);
    return {
      content: t(locale, "invite.aiStarting", {
        challenger: opts.challenger.displayName,
        level: opts.aiLevel,
        side: sideLabel(locale, opts.challengerSide),
      }),
      ephemeral: true,
    };
  });
}
