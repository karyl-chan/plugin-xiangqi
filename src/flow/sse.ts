import { getGameBySession } from "../game/store.js";
import { buildSnapshot } from "../game/snapshot.js";

/**
 * Per-channel SSE subscriber registry. Pattern matches the quest-game
 * sse.ts: every gameplay mutation calls `notifyGameChanged(channelId)`
 * which iterates subscribers and pushes a per-viewer snapshot.
 */

export interface SseSubscriber {
  userId: string;
  sessionId: string;
  send: (payload: unknown) => void;
}

const channels = new Map<string, Set<SseSubscriber>>();

export function subscribe(channelId: string, sub: SseSubscriber): () => void {
  let set = channels.get(channelId);
  if (!set) {
    set = new Set();
    channels.set(channelId, set);
  }
  set.add(sub);
  return () => {
    const current = channels.get(channelId);
    if (!current) return;
    current.delete(sub);
    if (current.size === 0) channels.delete(channelId);
  };
}

export function notifyGameChanged(channelId: string): void {
  const set = channels.get(channelId);
  if (!set || set.size === 0) return;
  for (const sub of set) {
    const game = getGameBySession(channelId, sub.sessionId);
    try {
      sub.send(game ? buildSnapshot(game, sub.userId) : { gone: true });
    } catch {
      /* broken pipe — closeHook unsubscribes */
    }
  }
}

export function subscriberCount(channelId: string): number {
  return channels.get(channelId)?.size ?? 0;
}
