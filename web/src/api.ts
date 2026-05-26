// Browser-side API client for the xiangqi SPA. Built on
// @karyl-chan/plugin-sdk/web's `bootstrapPluginSession` orchestrator —
// JWT decode, manage exchange, refresh, sessionStorage restore and
// the authed fetch wrapper all live inside the SessionHandle owned by
// App.vue. This module exposes the typed feature endpoints; it
// receives the `PluginApi` via `setApi` once bootstrap resolves.

import { API_BASE, type PluginApi } from "@karyl-chan/plugin-sdk/web";

/** Channel + session-id pair the game-board SPA was opened with. The
 *  authentication token used to live here too; that's now owned by
 *  the SDK's auth state and reached via `pluginApi().request(...)`. */
export interface GameSession {
  channelId: string;
  sessionId: string;
}

let _api: PluginApi | null = null;

export function setApi(api: PluginApi): void {
  _api = api;
}

function pluginApi(): PluginApi {
  if (!_api) {
    throw new Error("xiangqi api used before bootstrapPluginSession resolved");
  }
  return _api;
}

export { API_BASE };

// ── Game endpoints ────────────────────────────────────────────────────

export async function fetchGameState(s: GameSession): Promise<unknown> {
  try {
    return await pluginApi().request(
      "GET",
      `/api/game/state?channel=${encodeURIComponent(s.channelId)}&session=${encodeURIComponent(s.sessionId)}`,
    );
  } catch (err) {
    // Treat 404 as "this game has ended" rather than a hard error —
    // the board renders a "game gone" state. PluginApi rejects with
    // an Error containing the message body, so sniff the message.
    if (err instanceof Error && /404|not.found/i.test(err.message)) {
      return { gone: true };
    }
    throw err;
  }
}

export function postGameAction(
  s: GameSession,
  body: Record<string, unknown>,
): Promise<unknown> {
  return pluginApi().request("POST", "/api/game/action", {
    channel: s.channelId,
    session: s.sessionId,
    ...body,
  });
}

export async function mintSseTicket(s: GameSession): Promise<string> {
  const body = await pluginApi().request<{ ticket: string }>(
    "POST",
    "/api/game/sse-ticket",
    { channel: s.channelId, session: s.sessionId },
  );
  return body.ticket;
}

export function gameSseUrl(s: GameSession, ticket: string): string {
  return (
    `${API_BASE}/api/game/events` +
    `?channel=${encodeURIComponent(s.channelId)}` +
    `&session=${encodeURIComponent(s.sessionId)}` +
    `&ticket=${encodeURIComponent(ticket)}`
  );
}

// ── Manage endpoints ──────────────────────────────────────────────────

export async function manageListGames(): Promise<unknown[]> {
  const body = await pluginApi().request<{ games: unknown[] }>(
    "GET",
    "/api/manage/games",
  );
  return body.games;
}

export function manageStopGame(channelId: string): Promise<void> {
  return pluginApi().request<void>(
    "POST",
    `/api/manage/games/${encodeURIComponent(channelId)}/stop`,
  );
}

declare global {
  interface Window {
    __PLUGIN_BASE__?: string;
  }
}
