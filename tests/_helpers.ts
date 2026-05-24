import { vi } from "vitest";
import { wireRuntime } from "../src/runtime.js";

/**
 * Test setup helper. The runtime() handle in src/runtime.ts must be
 * wired before any flow code touches `runtime().botRpc(...)` etc.
 * Tests inject fakes so message-send and engine RPCs become no-ops.
 */
export function installFakeRuntime(): {
  botRpcCalls: Array<{ path: string; body: unknown }>;
} {
  const botRpcCalls: Array<{ path: string; body: unknown }> = [];
  const noop = (..._args: unknown[]): void => {};
  wireRuntime({
    botRpc: vi.fn(async (path: string, body?: unknown) => {
      botRpcCalls.push({ path, body });
      if (path === "/api/plugin/messages.send") return { id: "fake-msg", channel_id: "c" };
      if (path === "/api/plugin/auth.session")
        return { allowed: true, token: "fake.jwt.tok" };
      return { ok: true };
    }),
    log: { info: noop, warn: noop, error: noop },
    publicBaseUrl: () => "http://localhost/plugin/karyl-xiangqi",
    dispatchHmacKey: () => "00".repeat(32),
    sessionVerifyKey: () => "-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----",
  });
  return { botRpcCalls };
}
