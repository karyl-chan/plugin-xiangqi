import { spawn, type ChildProcess } from "node:child_process";
import { runtime } from "../runtime.js";

/**
 * Lazy UCI xiangqi engine process pool. One engine instance per active
 * AI game (keyed by sessionId). Engines stay alive for the duration of
 * the game — explicit teardown via `shutdownEngine(sessionId)` happens
 * when the game ends (move-apply.finaliseGame → cancelAiStep). The
 * idle timer here is a 2-hour safety net for abandoned games where the
 * normal teardown path is never reached.
 *
 * Production runtime ships Pikafish (xiangqi-specialised Stockfish fork
 * with NNUE eval; ~3200 Elo). The handshake also sends the
 * `UCI_Variant=xiangqi` option for fairy-stockfish compatibility in
 * dev mode — Pikafish ignores unknown setoption lines.
 *
 * Both engines accept `position fen` + `go depth` / `go movetime` and
 * emit `bestmove e2e4`-style ICCS coordinates.
 *
 * The binary path is taken from `XIANGQI_ENGINE_PATH` env var; defaults
 * to `pikafish` (in PATH). If the binary isn't available the plugin
 * still loads — `bestMove` returns null and AI games fall back to a
 * random legal move at the higher layer (with a warn log explaining
 * why).
 */

const ENGINE_PATH = process.env.XIANGQI_ENGINE_PATH ?? "pikafish";
// 2-hour fallback for abandoned games. Active games shouldn't hit this —
// finaliseGame triggers explicit shutdown on natural end.
const IDLE_KILL_MS = 2 * 60 * 60_000;
// Cold container start (binary load + UCI handshake) can comfortably
// exceed 5s on a small VPS; 15s tolerates that without falling back.
const ENGINE_READY_TIMEOUT_MS = 15_000;
const ENGINE_GO_TIMEOUT_MS = 30_000;
const ENGINE_THREADS = 2;
const ENGINE_HASH_MB = 256;

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

  // UCI handshake. UCI_Variant is a fairy-stockfish-only option and is
  // silently ignored by Pikafish; sending it keeps dev mode working
  // when XIANGQI_ENGINE_PATH points at fairy-stockfish.
  send(child, "uci");
  send(child, "setoption name UCI_Variant value xiangqi");
  send(child, `setoption name Threads value ${ENGINE_THREADS}`);
  send(child, `setoption name Hash value ${ENGINE_HASH_MB}`);
  send(child, "isready");
  const ok = await waitForReady(child, ENGINE_READY_TIMEOUT_MS);
  if (!ok) {
    runtime().log.warn("xiangqi: engine handshake timed out", {
      sessionId,
      enginePath: ENGINE_PATH,
      timeoutMs: ENGINE_READY_TIMEOUT_MS,
    });
    killEngine(sessionId);
    return null;
  }
  slot.ready = true;
  runtime().log.info("xiangqi: engine ready", {
    sessionId,
    enginePath: ENGINE_PATH,
    threads: ENGINE_THREADS,
    hashMb: ENGINE_HASH_MB,
  });

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
    // Combined `go depth N movetime M` lets the engine stop at whichever
    // limit fires first — depth bounds endgame think-time, movetime
    // bounds midgame wall-time. Both supplied = explicit dual cap.
    const goLine =
      opts.movetimeMs != null
        ? `go depth ${opts.depth} movetime ${opts.movetimeMs}`
        : `go depth ${opts.depth}`;
    send(slot.child, goLine);
  });
}

export function engineParamsForLevel(
  level: "easy" | "normal" | "hard",
): { depth: number; movetimeMs?: number } {
  switch (level) {
    case "easy":
      return { depth: 4 };
    case "normal":
      return { depth: 8 };
    case "hard":
      // depth 20 with a 5s movetime cap: lets the engine search deep on
      // tactical positions but bounds wall time so AI replies stay
      // snappy. Combined with Threads=2 + Hash=256MB this is meaningfully
      // stronger than the previous depth-12-only setting.
      return { depth: 20, movetimeMs: 5_000 };
  }
}
