import { ENDED_GAME_TTL_MS } from "../constants.js";
import type { GameState } from "./state.js";

/**
 * Per-channel game store. At most one active game per channel. Closely
 * mirrors the quest-game plugin's store: an active map + a retention map
 * for ended games, plus a per-channel promise-chain lock for serialising
 * mutations from the slash command, the message watcher, the WebUI, and
 * the AI timer.
 *
 * All state lives in memory; a process restart wipes everything.
 */

const games = new Map<string, GameState>();

export function getGame(channelId: string): GameState | null {
  return games.get(channelId) ?? null;
}

export function setGame(channelId: string, state: GameState): void {
  games.set(channelId, state);
}

export function removeGame(channelId: string): void {
  games.delete(channelId);
}

export function listGames(): GameState[] {
  return [...games.values()];
}

interface RetentionEntry {
  state: GameState;
  expiresAt: number;
  timer: NodeJS.Timeout;
}

const endedGames = new Map<string, RetentionEntry>();

export function retainEndedGame(state: GameState): void {
  const channelId = state.channelId;
  games.delete(channelId);
  clearTimeout(endedGames.get(channelId)?.timer);
  const timer = setTimeout(() => {
    if (endedGames.get(channelId)?.state.sessionId === state.sessionId) {
      endedGames.delete(channelId);
    }
  }, ENDED_GAME_TTL_MS);
  if (typeof timer.unref === "function") timer.unref();
  endedGames.set(channelId, {
    state,
    expiresAt: Date.now() + ENDED_GAME_TTL_MS,
    timer,
  });
}

export function getEndedGame(channelId: string): GameState | null {
  const entry = endedGames.get(channelId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    endedGames.delete(channelId);
    return null;
  }
  return entry.state;
}

export function listEndedGames(): GameState[] {
  const now = Date.now();
  const out: GameState[] = [];
  for (const [channelId, entry] of endedGames.entries()) {
    if (entry.expiresAt <= now) {
      endedGames.delete(channelId);
      continue;
    }
    out.push(entry.state);
  }
  return out;
}

export function getGameBySession(
  channelId: string,
  sessionId: string,
): GameState | null {
  const active = games.get(channelId);
  if (active && active.sessionId === sessionId) return active;
  const ended = endedGames.get(channelId);
  if (
    ended &&
    ended.expiresAt > Date.now() &&
    ended.state.sessionId === sessionId
  ) {
    return ended.state;
  }
  return null;
}

const chains = new Map<string, Promise<unknown>>();

export function withChannelLock<T>(
  channelId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = chains.get(channelId) ?? Promise.resolve();
  const result = prev.then(fn, fn);
  const link: Promise<unknown> = result.then(
    () => undefined,
    () => undefined,
  );
  chains.set(channelId, link);
  void link.then(() => {
    if (chains.get(channelId) === link) chains.delete(channelId);
  });
  return result;
}

/** Test/teardown helper. Not used in production code paths. */
export function _resetStoreForTests(): void {
  for (const e of endedGames.values()) clearTimeout(e.timer);
  endedGames.clear();
  games.clear();
  chains.clear();
}
