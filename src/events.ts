import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  isFreshTimestamp,
  verify,
} from "@karyl-chan/plugin-sdk";
import { runtime } from "./runtime.js";
import { onGuildMessageCreate } from "./flow/move-watcher.js";

/**
 * `/events` is the entry point for bot-dispatched events (subscriptions
 * declared via `guildFeature.eventsSubscribed`). The SDK only verifies
 * the HMAC on its built-in `/commands` + `/components`; we re-implement
 * the same verification here using the SDK-exported hmac primitives.
 *
 * Bodies arrive as JSON. The raw-body content-type parser is configured
 * at server creation in index.ts so we still have access to the
 * stringified payload for HMAC verification.
 */
export function registerEventRoute(server: FastifyInstance): void {
  server.post("/events", { config: { rawBody: true } }, async (req, reply) => {
    const raw = readRawBody(req);
    const secret = runtime().dispatchHmacKey();
    if (!secret) {
      reply.code(503);
      return { error: "plugin not registered" };
    }
    if (!verifyAuth(req, raw, secret)) {
      reply.code(401);
      return { error: "bad signature" };
    }
    // ACK quickly; do the work without blocking the reply.
    reply.code(204).send();

    let body: { type?: string; data?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      runtime().log.warn("xiangqi: /events JSON parse failed");
      return;
    }
    if (body?.type === "guild.message_create") {
      const data = body.data as Parameters<typeof onGuildMessageCreate>[0];
      if (data && typeof data.channel_id === "string") {
        try {
          await onGuildMessageCreate(data);
        } catch (e) {
          runtime().log.warn("xiangqi: onGuildMessageCreate failed", {
            err: (e as Error).message,
          });
        }
      }
    }
  });
}

function readRawBody(req: FastifyRequest): string {
  const raw = (req as unknown as { rawBody?: string }).rawBody;
  if (typeof raw === "string") return raw;
  if (typeof req.body === "string") return req.body;
  if (req.body != null) return JSON.stringify(req.body);
  return "";
}

function verifyAuth(
  req: FastifyRequest,
  rawBody: string,
  secret: string,
): boolean {
  const ts = req.headers[TIMESTAMP_HEADER];
  const sig = req.headers[SIGNATURE_HEADER];
  if (typeof ts !== "string" || typeof sig !== "string") return false;
  if (!isFreshTimestamp(ts, Math.floor(Date.now() / 1000))) return false;
  const urlPath = req.url.split("?")[0];
  return verify({
    secret,
    method: req.method,
    path: urlPath,
    body: rawBody,
    ts,
    presented: sig,
  });
}
