import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import {
  hasPluginCapability,
  verifyPluginSession,
  type PluginSessionClaims,
} from "@karyl-chan/plugin-sdk";
import { PLUGIN_KEY } from "./constants.js";
import { t } from "./i18n/index.js";
import {
  issueManagePair,
  verifyManageToken,
  type ManageClaims,
} from "./manage-tokens.js";
import {
  getEndedGame,
  getGame,
  listGames,
  removeGame,
  withChannelLock,
} from "./game/store.js";
import { buildSnapshot } from "./game/snapshot.js";
import { isOfferPending, sideOf } from "./game/state.js";
import { parseAny } from "./xiangqi/notation/parse.js";
import { parseIccs } from "./xiangqi/notation/parse-iccs.js";
import { applyMoveToGame, isMoversTurn } from "./flow/move-apply.js";
import { tickClockOnMove, stopClockTicker } from "./flow/clock.js";
import { cancelAiStep, scheduleAiStep } from "./engine/npc-driver.js";
import { notifyGameChanged, subscribe } from "./flow/sse.js";
import { applyResignBySide } from "./flow/resign.js";
import {
  applyAcceptDrawBySide,
  applyDeclineDrawBySide,
  applyOfferDrawBySide,
} from "./flow/draw.js";
import {
  applyAcceptTakebackBySide,
  applyDeclineTakebackBySide,
  applyOfferTakebackBySide,
} from "./flow/takeback.js";

const MANAGE_CAP = "manage";

let _sessionVerifyKey: (() => string | null) | null = null;
export function setSessionVerifyKey(getter: () => string | null): void {
  _sessionVerifyKey = getter;
}

let _publicBaseUrlGetter: (() => string | undefined) | null = null;
export function setPublicBaseUrl(getter: () => string | undefined): void {
  _publicBaseUrlGetter = getter;
}

let _publicUrlEnvFallback: string | undefined;
export function setPublicUrlEnvFallback(value: string | undefined): void {
  _publicUrlEnvFallback = value;
}

export function effectiveBase(): string {
  const sdkUrl = _publicBaseUrlGetter?.();
  if (sdkUrl) return sdkUrl.replace(/\/+$/, "");
  if (_publicUrlEnvFallback) return _publicUrlEnvFallback;
  return "http://localhost:903";
}

// ── auth helpers ──────────────────────────────────────────────────────────

function authSession(req: FastifyRequest): PluginSessionClaims | null {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  const pubKey = _sessionVerifyKey?.();
  if (!pubKey) return null;
  return verifyPluginSession(token, pubKey);
}

function authManageBootstrap(req: FastifyRequest): PluginSessionClaims | null {
  const claims = authSession(req);
  if (!claims) return null;
  if (!hasPluginCapability(claims.capabilities, PLUGIN_KEY, MANAGE_CAP)) return null;
  return claims;
}

function authManageAccess(req: FastifyRequest): ManageClaims | null {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return verifyManageToken(token, "manage-access");
}

/**
 * The SDK installs a global `application/json` parser that returns the
 * raw body as a STRING (so it can HMAC-verify dispatch routes). Every
 * POST handler in this file needs to JSON-parse it back to an object.
 * Returns {} on missing / malformed body so callers can `?.field` safely.
 */
function readJsonBody<T = Record<string, unknown>>(req: FastifyRequest): T {
  const b = req.body;
  if (b == null || b === "") return {} as T;
  if (typeof b === "string") {
    try {
      return JSON.parse(b) as T;
    } catch {
      return {} as T;
    }
  }
  return b as T;
}

// ── SSE ticket store ──────────────────────────────────────────────────────

interface SseTicketEntry {
  userId: string;
  channelId: string;
  sessionId: string;
  expiresAt: number;
}
const sseTickets = new Map<string, SseTicketEntry>();
const SSE_TICKET_TTL_MS = 20_000;

function mintSseTicket(entry: Omit<SseTicketEntry, "expiresAt">): string {
  const tk = randomBytes(18).toString("base64url");
  sseTickets.set(tk, { ...entry, expiresAt: Date.now() + SSE_TICKET_TTL_MS });
  // Sweep old tickets opportunistically.
  if (sseTickets.size > 256) {
    const now = Date.now();
    for (const [k, v] of sseTickets) if (v.expiresAt < now) sseTickets.delete(k);
  }
  return tk;
}

function consumeSseTicket(token: string): SseTicketEntry | null {
  const entry = sseTickets.get(token);
  if (!entry) return null;
  // One-time use: delete on read so an intercepted ticket can't open
  // additional streams within the TTL window.
  sseTickets.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry;
}

// ── SPA serving ───────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SPA_HTML_PATH = join(__dirname, "ui", "index.html");

function serveSpa(reply: FastifyReply): string {
  let html: string;
  try {
    html = readFileSync(SPA_HTML_PATH, "utf-8");
  } catch {
    reply.code(500);
    return JSON.stringify({ error: "SPA bundle not built" });
  }
  const base = effectiveBase();
  const baseUrl = new URL(base);
  // Express the base path piece relative to the host so the SPA can
  // build all API URLs through window.__PLUGIN_BASE__.
  const basePath = baseUrl.pathname.replace(/\/+$/, "");
  const injected = html.replace(
    /__PLUGIN_BASE__\s*=\s*"[^"]*"/,
    `__PLUGIN_BASE__ = "${basePath}"`,
  );
  reply.header("content-type", "text/html; charset=utf-8");
  // The SPA is rebuilt on every plugin deploy, so the inline JS hash
  // changes — but the HTML URL itself doesn't, so without this header
  // browsers happily serve a stale copy from disk cache for hours.
  reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
  // The vite-plugin-singlefile bundle inlines every JS + CSS chunk into
  // the HTML, so the bot proxy's strict default CSP (`script-src 'self';
  // style-src 'self'`) would block them. Send our own CSP that allows
  // inline JS + CSS but locks everything else down — same pattern as
  // the quest-game plugin. `connect-src 'self'` is needed for fetch +
  // EventSource against this plugin's API surface.
  reply.header(
    "Content-Security-Policy",
    "default-src 'none'; img-src 'self' data: blob:; " +
      "style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
      "connect-src 'self'; font-src 'self' data:; " +
      "base-uri 'none'; form-action 'none'",
  );
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("Referrer-Policy", "no-referrer");
  return injected;
}

// ── routes ────────────────────────────────────────────────────────────────

export async function registerWebRoutes(server: FastifyInstance): Promise<void> {
  // — SPA
  server.get("/", async (_req, reply) => serveSpa(reply));
  // The bot proxies `…/plugin/karyl-xiangqi` (no trailing slash) with a
  // 301 → `…/plugin/karyl-xiangqi/`, so this exact-`/` route is the only
  // SPA entry point. We don't mount a wildcard fallback because that
  // would shadow all other API routes.

  // — game-state APIs
  server.get<{ Querystring: { channel?: string; session?: string } }>(
    "/api/game/state",
    async (req, reply) => {
      const claims = authSession(req);
      if (!claims) {
        reply.code(401);
        return { error: "unauthorized" };
      }
      const channelId = req.query.channel;
      const sessionId = req.query.session;
      if (!channelId || !sessionId) {
        reply.code(400);
        return { error: "missing channel/session" };
      }
      const game = getGame(channelId) ?? getEndedGame(channelId);
      if (!game || game.sessionId !== sessionId) {
        reply.code(404);
        return { gone: true };
      }
      if (claims.guildId !== game.guildId) {
        reply.code(403);
        return { error: "wrong guild" };
      }
      return buildSnapshot(game, claims.userId);
    },
  );

  server.post("/api/game/action", async (req, reply) => {
    const claims = authSession(req);
    if (!claims) {
      reply.code(401);
      return { error: "unauthorized" };
    }
    const body = readJsonBody<{
      channel?: string;
      session?: string;
      type?: string;
      from?: string;
      to?: string;
      move?: string;
    }>(req);
    const channelId = body.channel;
    const sessionId = body.session;
    const type = body.type;
    if (!channelId || !sessionId || !type) {
      reply.code(400);
      return { error: "missing fields" };
    }
    return withChannelLock(channelId, async () => {
      const game = getGame(channelId);
      if (!game || game.sessionId !== sessionId || game.status !== "active") {
        reply.code(404);
        return { error: "no active game" };
      }
      if (claims.guildId !== game.guildId) {
        reply.code(403);
        return { error: "wrong guild" };
      }
      const side = sideOf(game, claims.userId);
      if (!side) {
        reply.code(403);
        return { error: "not a player" };
      }
      if (type === "move") {
        if (isOfferPending(game)) {
          reply.code(409);
          return { error: t(game.locale, "pause.cannotMove") };
        }
        if (!isMoversTurn(game, side)) {
          reply.code(409);
          return { error: "not your turn" };
        }
        const raw = body.move ?? `${body.from ?? ""}${body.to ?? ""}`;
        let parsed = raw ? parseIccs(raw) : null;
        if (!parsed && raw) parsed = parseAny(raw, game.board, side);
        if (!parsed) {
          reply.code(400);
          return { error: "illegal move" };
        }
        try {
          await applyMoveToGame(game, side, parsed.from, parsed.to, {
            source: "webui",
            onPostApply: (s) => tickClockOnMove(s, Date.now()),
          });
        } catch (e) {
          reply.code(400);
          return { error: (e as Error).message };
        }
        if (game.status === "active") {
          const stm = game.board.sideToMove === "red" ? game.red : game.black;
          if (stm.kind === "ai") scheduleAiStep(game);
        }
        return { ok: true };
      }
      if (type === "resign") {
        await applyResignBySide(game, side);
        return { ok: true };
      }
      if (type === "draw-offer") {
        if (isOfferPending(game)) {
          reply.code(409);
          return { error: "an offer is already pending" };
        }
        const r = await applyOfferDrawBySide(game, side);
        if (r === "vs_ai_declined") return { ok: true, declined: true };
        return { ok: true };
      }
      if (type === "draw-accept" || type === "draw-decline") {
        if (!game.drawOffer) {
          reply.code(409);
          return { error: "no draw offer pending" };
        }
        if (game.drawOffer.from === side) {
          reply.code(403);
          return { error: "cannot resolve own offer" };
        }
        if (type === "draw-accept") await applyAcceptDrawBySide(game);
        else await applyDeclineDrawBySide(game);
        return { ok: true };
      }
      if (type === "takeback-offer") {
        if (isOfferPending(game)) {
          reply.code(409);
          return { error: "an offer is already pending" };
        }
        const outcome = await applyOfferTakebackBySide(game, side);
        if (outcome.kind === "no_history") {
          reply.code(409);
          return { error: "no moves to take back" };
        }
        return { ok: true, outcome: outcome.kind };
      }
      if (type === "takeback-accept" || type === "takeback-decline") {
        if (!game.takebackOffer) {
          reply.code(409);
          return { error: "no takeback offer pending" };
        }
        if (game.takebackOffer.from === side) {
          reply.code(403);
          return { error: "cannot resolve own offer" };
        }
        if (type === "takeback-accept") await applyAcceptTakebackBySide(game);
        else await applyDeclineTakebackBySide(game);
        return { ok: true };
      }
      reply.code(400);
      return { error: "unknown action type" };
    });
  });

  server.post("/api/game/sse-ticket", async (req, reply) => {
    const claims = authSession(req);
    if (!claims) {
      reply.code(401);
      return { error: "unauthorized" };
    }
    const body = readJsonBody<{ channel?: string; session?: string }>(req);
    const channelId = body.channel;
    const sessionId = body.session;
    if (!channelId || !sessionId) {
      reply.code(400);
      return { error: "missing channel/session" };
    }
    const ticket = mintSseTicket({
      userId: claims.userId,
      channelId,
      sessionId,
    });
    return { ticket };
  });

  server.get<{ Querystring: { channel?: string; session?: string; ticket?: string } }>(
    "/api/game/events",
    (req, reply) => {
      const channelId = req.query.channel;
      const sessionId = req.query.session;
      const ticket = req.query.ticket;
      if (!channelId || !sessionId || !ticket) {
        reply.code(400).send({ error: "missing params" });
        return;
      }
      const entry = consumeSseTicket(ticket);
      if (!entry || entry.channelId !== channelId || entry.sessionId !== sessionId) {
        reply.code(401).send({ error: "bad ticket" });
        return;
      }

      reply.raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      });
      reply.hijack();

      const send = (payload: unknown): void => {
        try {
          reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch {
          /* ignored — close handler unsubs */
        }
      };

      const game = getGame(channelId) ?? getEndedGame(channelId);
      if (game && game.sessionId === sessionId) {
        send(buildSnapshot(game, entry.userId));
      } else {
        send({ gone: true });
      }

      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(": hb\n\n");
        } catch {
          /* ignore */
        }
      }, 25_000);
      if (typeof heartbeat.unref === "function") heartbeat.unref();

      const unsubscribe = subscribe(channelId, {
        userId: entry.userId,
        sessionId,
        send,
      });

      reply.raw.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );

  // — manage
  server.post("/api/manage/exchange", async (req, reply) => {
    const claims = authManageBootstrap(req);
    if (!claims) {
      reply.code(403);
      return { error: "not allowed" };
    }
    return issueManagePair(claims.userId, claims.capabilities);
  });

  server.post("/api/manage/refresh", async (req, reply) => {
    const body = readJsonBody<{ refreshToken?: string }>(req);
    const rt = body.refreshToken;
    if (typeof rt !== "string") {
      reply.code(400);
      return { error: "missing refreshToken" };
    }
    const claims = verifyManageToken(rt, "manage-refresh");
    if (!claims) {
      reply.code(401);
      return { error: "invalid refresh" };
    }
    return issueManagePair(claims.userId, claims.capabilities);
  });

  server.get("/api/manage/games", async (req, reply) => {
    const claims = authManageAccess(req);
    if (!claims) {
      reply.code(401);
      return { error: "unauthorized" };
    }
    if (!claims.capabilities.includes("admin") && !claims.capabilities.includes(`plugin:${PLUGIN_KEY}:${MANAGE_CAP}`)) {
      reply.code(403);
      return { error: "missing capability" };
    }
    const games = listGames();
    return {
      games: games.map((g) => ({
        sessionId: g.sessionId,
        channelId: g.channelId,
        guildId: g.guildId,
        red: { userId: g.red.userId, displayName: g.red.displayName, kind: g.red.kind },
        black: {
          userId: g.black.userId,
          displayName: g.black.displayName,
          kind: g.black.kind,
        },
        status: g.status,
        plies: g.history.length,
        createdAt: g.createdAt,
        acceptedAt: g.acceptedAt,
      })),
    };
  });

  server.post<{ Params: { channelId: string } }>(
    "/api/manage/games/:channelId/stop",
    async (req, reply) => {
      const claims = authManageAccess(req);
      if (!claims) {
        reply.code(401);
        return { error: "unauthorized" };
      }
      const channelId = req.params.channelId;
      return withChannelLock(channelId, async () => {
        const game = getGame(channelId);
        if (!game) {
          reply.code(404);
          return { error: "no game" };
        }
        const now = Date.now();
        game.status = "aborted";
        game.result = { reason: "aborted", at: now };
        game.endedAt = now;
        stopClockTicker(game.sessionId);
        cancelAiStep(game.sessionId);
        // Force-stop, like /xiangqi stop, intentionally does NOT retain —
        // a stopped game has no result worth reviewing.
        removeGame(channelId);
        notifyGameChanged(channelId);
        return { ok: true };
      });
    },
  );

  // health probe (in addition to the SDK-provided one) for manage UI
  server.get("/api/manage/health", async () => ({ ok: true }));
}
