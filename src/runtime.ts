/**
 * Module-level runtime handle. The flow files (start/move/draw/...) all
 * need `botRpc` + a logger + the public base URL, but threading them
 * through every call site bloats every signature. Same pattern as the
 * quest-game plugin: index.ts assigns once after start() resolves, and
 * the rest of the code reads them through runtime().
 */

import type { Logger } from "@karyl-chan/plugin-sdk";

export interface XiangqiRuntime {
  botRpc: (path: string, body?: unknown) => Promise<unknown | null>;
  log: Logger;
  publicBaseUrl: () => string | undefined;
  /** Dispatch HMAC key for verifying inbound bot events on /events. */
  dispatchHmacKey: () => string | null;
  /** Ed25519 SPKI PEM that signs plugin-session JWTs. */
  sessionVerifyKey: () => string | null;
}

const BOT_RPC_TIMEOUT_MS = 8000;

let _rt: XiangqiRuntime | null = null;

/**
 * Wrap a raw botRpc fn with a hard timeout. A stalled bot RPC (mid-restart
 * socket, Discord rate-limit hold-up, network blip) would otherwise hang
 * an awaited WebUI POST or /events handler indefinitely. Returns null on
 * timeout, matching the SDK's existing "null on failure" contract.
 */
function withTimeout(
  fn: XiangqiRuntime["botRpc"],
  log: XiangqiRuntime["log"],
): XiangqiRuntime["botRpc"] {
  return (path, body) =>
    new Promise<unknown | null>((resolve) => {
      const timer = setTimeout(() => {
        log.warn("xiangqi: botRpc timed out", { path });
        resolve(null);
      }, BOT_RPC_TIMEOUT_MS);
      fn(path, body)
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((e) => {
          clearTimeout(timer);
          log.warn("xiangqi: botRpc rejected", {
            path,
            err: (e as Error).message,
          });
          resolve(null);
        });
    });
}

export function wireRuntime(rt: XiangqiRuntime): void {
  _rt = { ...rt, botRpc: withTimeout(rt.botRpc, rt.log) };
}

export function runtime(): XiangqiRuntime {
  if (!_rt) throw new Error("runtime not wired yet");
  return _rt;
}

export function runtimeMaybe(): XiangqiRuntime | null {
  return _rt;
}
