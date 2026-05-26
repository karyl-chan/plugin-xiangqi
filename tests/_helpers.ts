import { vi } from "vitest";
import { wireRuntime } from "../src/runtime.js";
// Use the SDK's createPluginRpc inside tests so the typed namespace
// behaviour stays in sync with production — if the SDK changes the
// wire-path for a method, this fake follows automatically and the
// botRpcCalls assertions stay meaningful.
import { createPluginRpc } from "@karyl-chan/plugin-sdk";

/**
 * Test setup helper. The runtime() handle in src/runtime.ts must be
 * wired before any flow code touches `runtime().botRpc(...)` etc.
 * Tests inject fakes so message-send and engine RPCs become no-ops.
 *
 * `botRpcCalls` records BOTH legacy botRpc calls AND typed
 * `runtime().discord.*` / `runtime().voice.*` calls (the typed surface
 * is implemented atop the same RpcCaller and lands here too).
 */
export function installFakeRuntime(): {
  botRpcCalls: Array<{ path: string; body: unknown }>;
} {
  const botRpcCalls: Array<{ path: string; body: unknown }> = [];
  const noop = (..._args: unknown[]): void => {};
  const fakeCall = vi.fn(async (path: string, body?: unknown) => {
    botRpcCalls.push({ path, body });
    if (path === "/api/plugin/messages.send")
      return { id: "fake-msg", channel_id: "c" };
    if (path === "/api/plugin/auth.session")
      return { allowed: true, token: "fake.jwt.tok" };
    return { ok: true };
  });
  const rpc = createPluginRpc(fakeCall);
  wireRuntime({
    botRpc: fakeCall,
    discord: rpc.discord,
    voice: rpc.voice,
    log: { info: noop, warn: noop, error: noop },
    publicBaseUrl: () => "http://localhost/plugin/karyl-xiangqi",
    sessionVerifyKey: () =>
      "-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----",
  });
  return { botRpcCalls };
}
