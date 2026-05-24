declare global {
  interface Window {
    __PLUGIN_BASE__?: string;
  }
}

function apiBase(): string {
  const base = window.__PLUGIN_BASE__ ?? "";
  return `${location.origin}${base}`;
}

export interface GameSession {
  token: string;
  channelId: string;
  sessionId: string;
}

export interface ManageSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}

const GAME_SESSION_KEY = "karyl-xiangqi:gameSession";
const MANAGE_SESSION_KEY = "karyl-xiangqi:manageSession";

export function loadGameSession(): GameSession | null {
  try {
    const raw = sessionStorage.getItem(GAME_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveGameSession(s: GameSession): void {
  sessionStorage.setItem(GAME_SESSION_KEY, JSON.stringify(s));
}

export function clearGameSession(): void {
  sessionStorage.removeItem(GAME_SESSION_KEY);
}

export function loadManageSession(): ManageSession | null {
  try {
    const raw = sessionStorage.getItem(MANAGE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveManageSession(s: ManageSession): void {
  sessionStorage.setItem(MANAGE_SESSION_KEY, JSON.stringify(s));
}

export function clearManageSession(): void {
  sessionStorage.removeItem(MANAGE_SESSION_KEY);
}

// — game endpoints —

export async function fetchGameState(s: GameSession): Promise<unknown> {
  const url = `${apiBase()}/api/game/state?channel=${encodeURIComponent(s.channelId)}&session=${encodeURIComponent(s.sessionId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${s.token}` },
  });
  if (!res.ok) {
    if (res.status === 404) return { gone: true };
    throw new Error(`game state fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function postGameAction(
  s: GameSession,
  body: Record<string, unknown>,
): Promise<unknown> {
  const url = `${apiBase()}/api/game/action`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ channel: s.channelId, session: s.sessionId, ...body }),
  });
  return res.json();
}

export async function mintSseTicket(s: GameSession): Promise<string> {
  const url = `${apiBase()}/api/game/sse-ticket`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ channel: s.channelId, session: s.sessionId }),
  });
  if (!res.ok) throw new Error(`sse-ticket failed: ${res.status}`);
  const body = (await res.json()) as { ticket: string };
  return body.ticket;
}

export function gameSseUrl(s: GameSession, ticket: string): string {
  return `${apiBase()}/api/game/events?channel=${encodeURIComponent(s.channelId)}&session=${encodeURIComponent(s.sessionId)}&ticket=${encodeURIComponent(ticket)}`;
}

// — manage endpoints —

export async function exchangeManageToken(
  botJwt: string,
): Promise<ManageSession> {
  const url = `${apiBase()}/api/manage/exchange`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${botJwt}` },
  });
  if (!res.ok) throw new Error(`manage exchange failed: ${res.status}`);
  return res.json();
}

export async function refreshManageToken(refreshToken: string): Promise<ManageSession> {
  const url = `${apiBase()}/api/manage/refresh`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error(`manage refresh failed: ${res.status}`);
  return res.json();
}

export async function manageListGames(s: ManageSession): Promise<unknown[]> {
  const url = `${apiBase()}/api/manage/games`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${s.accessToken}` },
  });
  if (!res.ok) throw new Error(`manage list failed: ${res.status}`);
  const body = (await res.json()) as { games: unknown[] };
  return body.games;
}

export async function manageStopGame(s: ManageSession, channelId: string): Promise<void> {
  const url = `${apiBase()}/api/manage/games/${encodeURIComponent(channelId)}/stop`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.accessToken}` },
  });
  if (!res.ok) throw new Error(`manage stop failed: ${res.status}`);
}

// — URL parsing —

export function readUrlParams(): {
  token: string | null;
  c: string | null;
  s: string | null;
  mode: string | null;
} {
  const url = new URL(location.href);
  const out = {
    token: url.searchParams.get("token"),
    c: url.searchParams.get("c"),
    s: url.searchParams.get("s"),
    mode: url.searchParams.get("mode"),
  };
  // Strip from URL to avoid leaking in screenshots.
  if (out.token || out.c || out.s || out.mode) {
    url.searchParams.delete("token");
    url.searchParams.delete("c");
    url.searchParams.delete("s");
    url.searchParams.delete("mode");
    history.replaceState({}, "", url.toString());
  }
  return out;
}

export function decodeJwtPayload(token: string): unknown {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}
