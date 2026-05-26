import {
  componentCustomId,
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
  embeds?: unknown[];
  components?: unknown[];
  allowedMentions?: { users?: string[]; roles?: string[] };
}

export async function sendMessage(
  args: SendArgs,
): Promise<{ id: string; channel_id: string } | null> {
  const res = (await runtime().botRpc("/api/plugin/messages.send", {
    channel_id: args.channelId,
    content: args.content,
    embeds: args.embeds,
    components: args.components,
    allowed_mentions: args.allowedMentions,
  })) as { id: string; channel_id: string } | null;
  return res;
}

export async function editMessage(args: {
  channelId: string;
  messageId: string;
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
}): Promise<{ id: string; channel_id: string } | null> {
  return (await runtime().botRpc("/api/plugin/messages.edit", {
    channel_id: args.channelId,
    message_id: args.messageId,
    content: args.content,
    embeds: args.embeds,
    components: args.components,
  })) as { id: string; channel_id: string } | null;
}

export async function deleteMessage(args: {
  channelId: string;
  messageId: string;
}): Promise<void> {
  await runtime().botRpc("/api/plugin/messages.delete", {
    channel_id: args.channelId,
    message_id: args.messageId,
  });
}

export async function addReaction(args: {
  channelId: string;
  messageId: string;
  emoji: string;
}): Promise<void> {
  await runtime().botRpc("/api/plugin/messages.add_reaction", {
    channel_id: args.channelId,
    message_id: args.messageId,
    emoji: args.emoji,
  });
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
): Promise<void> {
  await ctx.botRpc("/api/plugin/interactions.followup", {
    interaction_token: ctx.interactionToken,
    content,
    ephemeral: true,
  });
}
