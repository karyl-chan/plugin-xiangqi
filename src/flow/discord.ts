import {
  componentCustomId,
  type APIEmbed,
  type ComponentContext,
  type MessageActionRow,
} from "@karyl-chan/plugin-sdk";
import { PLUGIN_KEY } from "../constants.js";
import { runtime } from "../runtime.js";

/**
 * Thin RPC wrappers. All Discord side-effects go through these so the
 * shape stays consistent and unit tests can stub a single set of
 * functions.
 */

interface SendArgs {
  channelId: string;
  content?: string;
  embeds?: APIEmbed[];
  components?: MessageActionRow[];
  allowedMentions?: { users?: string[]; roles?: string[] };
}

// All four wrappers preserve their pre-L-2 "null on failure" contract so
// existing callers (game flow / move-watcher) don't need a try/catch —
// the typed facade throws BotRpcError, we collapse to null here.

export async function sendMessage(
  args: SendArgs,
): Promise<{ id: string; channel_id: string } | null> {
  try {
    return await runtime().discord.messages.send(args);
  } catch (err) {
    runtime().log.warn("xiangqi: messages.send failed", {
      err: (err as Error).message,
    });
    return null;
  }
}

export async function editMessage(args: {
  channelId: string;
  messageId: string;
  content?: string;
  embeds?: APIEmbed[];
  components?: MessageActionRow[];
}): Promise<{ id: string; channel_id: string } | null> {
  try {
    return await runtime().discord.messages.edit(args);
  } catch (err) {
    runtime().log.warn("xiangqi: messages.edit failed", {
      err: (err as Error).message,
    });
    return null;
  }
}

export async function deleteMessage(args: {
  channelId: string;
  messageId: string;
}): Promise<void> {
  try {
    await runtime().discord.messages.delete(args);
  } catch (err) {
    runtime().log.warn("xiangqi: messages.delete failed", {
      err: (err as Error).message,
    });
  }
}

export async function addReaction(args: {
  channelId: string;
  messageId: string;
  emoji: string;
}): Promise<void> {
  try {
    await runtime().discord.messages.addReaction(args);
  } catch (err) {
    runtime().log.warn("xiangqi: messages.add_reaction failed", {
      err: (err as Error).message,
    });
  }
}

/** Convenience: a single Discord component-v1 "link button" row. */
export function linkButtonRow(label: string, url: string): MessageActionRow {
  return {
    type: 1,
    components: [{ type: 2, style: 5, label, url }],
  } as MessageActionRow;
}

/** Standard button styles per Discord component-v1 spec. */
export type ButtonStyle = 1 | 2 | 3 | 4;

export function buttonRow(
  buttons: Array<{ label: string; customId: string; style?: ButtonStyle; emoji?: string; disabled?: boolean }>,
): MessageActionRow {
  return {
    type: 1,
    components: buttons.map((b) => ({
      type: 2,
      style: b.style ?? 2,
      label: b.label,
      custom_id: b.customId,
      ...(b.emoji ? { emoji: { name: b.emoji } } : {}),
      ...(b.disabled ? { disabled: true } : {}),
    })),
  } as MessageActionRow;
}

export function buildCustomId(componentId: string, tail?: string): string {
  // Delegate to the SDK so we share its 100-char Discord-limit check.
  return componentCustomId(PLUGIN_KEY, componentId, tail);
}

/**
 * Send an ephemeral follow-up reply for a component click WITHOUT
 * editing the message the button is on. ComponentReply's
 * `{ content }` return form replaces the message — wrong for "you
 * can't click that" rejections. This helper uses the bot's
 * interactions.followup RPC instead, the only way to fire a
 * per-user-visible nudge from a component handler.
 */
export async function ephemeralFollowup(
  ctx: ComponentContext,
  content: string,
  components?: MessageActionRow[],
): Promise<void> {
  await ctx.discord.interactions.followup({
    interactionToken: ctx.interactionToken,
    content,
    ephemeral: true,
    ...(components && components.length > 0 ? { components } : {}),
  });
}
