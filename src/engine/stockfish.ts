import { spawn, type ChildProcess } from "node:child_process";
import { runtime } from "../runtime.js";

/**
 * Lazy fairy-stockfish process pool. One engine instance per active AI
 * game (keyed by sessionId). Engines are killed after 5 minutes of
 * inactivity, or immediately on game end.
 *
 * Communication uses UCI with the `UCI_Variant=xiangqi` option flipped
 * on. fairy-stockfish accepts the same `position fen`/`go depth`
 * commands and emits `bestmove e2e4`-style ICCS coordinates.
 *
 * The binary path is taken from `XIANGQI_ENGINE_PATH` env var; defaults
 * to `fairy-stockfish` (in PATH). If the binary isn't available the
 * plugin still loads — `bestMove` returns null and AI games fall back
 * to a random legal move at the higher layer.
 */

const ENGINE_PATH = process.env.XIANGQI_ENGINE_PATH ?? "fairy-stockfish";
const IDLE_KILL_MS = 5 * 60_000;
const ENGINE_READY_TIMEOUT_MS = 5_000;
const ENGINE_GO_TIMEOUT_MS = 30_000;

interface EngineSlot {
  child: ChildProcess;
  buffer: string;
  /** Sequential resolver queue — one bestmove → one resolver. */
  pending: Array<{
    resolve: (uci: string) => void;
    reject: (e: Error) => void;
    timer: NodeJS.Timeout;
  }>;
  idleTimer: NodeJS.Timeout;
  ready: boolean;
}

const engines = new Map<string, EngineSlot>();

function detachIdleTimer(slot: EngineSlot): void {
  clearTimeout(slot.idleTimer);
}

function armIdleTimer(sessionId: string, slot: EngineSlot): void {
  detachIdleTimer(slot);
  slot.idleTimer = setTimeout(() => {
    killEngine(sessionId);
  }, IDLE_KILL_MS);
  if (typeof slot.idleTimer.unref === "function") slot.idleTimer.unref();
}

function killEngine(sessionId: string): void {
  const slot = engines.get(sessionId);
  if (!slot) return;
  detachIdleTimer(slot);
  for (const p of slot.pending) {
    clearTimeout(p.timer);
    p.reject(new Error("engine shutting down"));
  }
  slot.pending.length = 0;
  try {
    slot.child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  engines.delete(sessionId);
}

export function shutdownEngine(sessionId: string): void {
  killEngine(sessionId);
}

export function shutdownAllEngines(): void {
  for (const id of [...engines.keys()]) killEngine(id);
}

async function ensureEngine(sessionId: string): Promise<EngineSlot | null> {
  const existing = engines.get(sessionId);
  if (existing && !existing.child.killed) return existing;

  let child: ChildProcess;
  try {
    child = spawn(ENGINE_PATH, [], { stdio: ["pipe", "pipe", "pipe"] });
  } catch (e) {
    runtime().log.warn("xiangqi: engine spawn failed", {
      err: (e as Error).message,
    });
    return null;
  }

  const slot: EngineSlot = {
    child,
    buffer: "",
    pending: [],
    idleTimer: setTimeout(() => {}, 0),
    ready: false,
  };
  detachIdleTimer(slot);

  child.stdout?.setEncoding("utf-8");
  child.stdout?.on("data", (chunk: string) => onData(sessionId, slot, chunk));
  child.stderr?.on("data", () => {
    /* fairy-stockfish writes to stderr on startup; ignore */
  });
  child.on("exit", () => {
    engines.delete(sessionId);
  });
  child.on("error", (e) => {
    runtime().log.warn("xiangqi: engine error", { err: e.message });
    killEngine(sessionId);
  });

  // UCI handshake
  send(child, "uci");
  send(child, "setoption name UCI_Variant value xiangqi");
  // Some builds of fairy-stockfish look for `UCI_Chess960` etc.; the
  // variant name is the load-bearing knob here.
  send(child, "isready");
  const ok = await waitForReady(child, ENGINE_READY_TIMEOUT_MS);
  if (!ok) {
    killEngine(sessionId);
    return null;
  }
  slot.ready = true;

  engines.set(sessionId, slot);
  armIdleTimer(sessionId, slot);
  return slot;
}

function send(child: ChildProcess, line: string): void {
  child.stdin?.write(line + "\n");
}

function onData(sessionId: string, slot: EngineSlot, chunk: string): void {
  slot.buffer += chunk;
  let nl: number;
  while ((nl = slot.buffer.indexOf("\n")) >= 0) {
    const line = slot.buffer.slice(0, nl).trim();
    slot.buffer = slot.buffer.slice(nl + 1);
    if (!line) continue;
    if (line.startsWith("bestmove ")) {
      const uci = line.split(/\s+/)[1] ?? "";
      const pending = slot.pending.shift();
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolve(uci);
      }
      armIdleTimer(sessionId, slot);
    }
  }
}

async function waitForReady(
  child: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let buffer = "";
    const t = setTimeout(() => {
      child.stdout?.off("data", onChunk);
      resolve(false);
    }, timeoutMs);
    function onChunk(c: string): void {
      buffer += c;
      if (buffer.includes("readyok")) {
        clearTimeout(t);
        child.stdout?.off("data", onChunk);
        resolve(true);
      }
    }
    child.stdout?.on("data", onChunk);
  });
}

export interface BestMoveOpts {
  fen: string;
  depth: number;
  movetimeMs?: number;
}

/**
 * Ask the engine for the best move from the given FEN. Returns a UCI/ICCS
 * move string like `b2e2`, or null on any failure (engine missing,
 * timeout, kill). Callers fall back to a random legal move on null.
 */
export async function bestMove(
  sessionId: string,
  opts: BestMoveOpts,
): Promise<string | null> {
  const slot = await ensureEngine(sessionId);
  if (!slot || !slot.ready) return null;
  return new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => {
      const idx = slot.pending.findIndex((p) => p.timer === timer);
      if (idx >= 0) slot.pending.splice(idx, 1);
      resolve(null);
    }, ENGINE_GO_TIMEOUT_MS);
    slot.pending.push({
      resolve: (uci) => resolve(uci),
      reject: () => resolve(null),
      timer,
    });
    send(slot.child, `position fen ${opts.fen}`);
    const goLine = opts.movetimeMs
      ? `go movetime ${opts.movetimeMs}`
      : `go depth ${opts.depth}`;
    send(slot.child, goLine);
  });
}

export function depthForLevel(level: "easy" | "normal" | "hard"): number {
  switch (level) {
    case "easy":
      return 4;
    case "normal":
      return 8;
    case "hard":
      return 12;
  }
}
