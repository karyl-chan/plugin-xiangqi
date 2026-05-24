import { randomBytes } from "node:crypto";
import type { Side } from "../xiangqi/pieces.js";

/**
 * "Open" invites — `/xiangqi start` without an `opponent` user. Anyone
 * (other than the challenger) can join via the public buttons; first
 * click wins. Kept SEPARATE from the active game store so a channel
 * can't have an open invite AND an active game at the same time and so
 * the cancel/cleanup paths are simple.
 *
 * Direct invites (with `opponent` set) live on the game store directly
 * with `status: "pending_accept"` — they're a different shape because
 * the invitee is already known and the GameState's `red` / `black`
 * PlayerRefs can be filled in immediately.
 */

export interface OpenInvite {
  inviteId: string;            // 16-hex
  channelId: string;
  guildId: string;
  challengerUserId: string;
  challengerDisplayName: string;
  /**
   * Side the challenger committed to via `side:` option, or null if
   * they let the opponent choose. When null, the public invite shows
   * BOTH `[加入紅方]` / `[加入黑方]` buttons; when set, only the
   * opposite-side button is shown.
   */
  challengerSide: Side | null;
  clock: { baseSec: number; incSec: number } | null;
  /** Forwarded to the GameState when this invite is promoted. */
  showBoard: boolean;
  inviteMessageId?: string;
  createdAt: number;
}

const invites = new Map<string, OpenInvite>();

export function getOpenInvite(channelId: string): OpenInvite | null {
  return invites.get(channelId) ?? null;
}

export function setOpenInvite(invite: OpenInvite): void {
  invites.set(invite.channelId, invite);
}

export function removeOpenInvite(channelId: string): void {
  invites.delete(channelId);
}

export function newInviteId(): string {
  return randomBytes(8).toString("hex");
}

/** Test-only teardown. */
export function _resetInvitesForTests(): void {
  invites.clear();
}
