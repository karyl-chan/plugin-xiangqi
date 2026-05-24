import { onMounted, onUnmounted, ref } from "vue";
import {
  fetchGameState,
  gameSseUrl,
  mintSseTicket,
  type GameSession,
} from "../api";

/**
 * SSE + polling-fallback subscription to the game state. Same shape as
 * the quest-game composable.
 */
export function useGameBoard(session: GameSession) {
  const state = ref<unknown>(null);
  const gone = ref(false);
  let es: EventSource | null = null;
  let pollTimer: number | null = null;
  let errorCount = 0;
  let stopped = false;

  async function loadOnce(): Promise<void> {
    try {
      const s = await fetchGameState(session);
      if ((s as { gone?: boolean })?.gone) {
        gone.value = true;
      } else {
        state.value = s;
      }
    } catch (e) {
      // ignore; retry handles it
    }
  }

  async function openSse(): Promise<void> {
    if (stopped) return;
    try {
      const ticket = await mintSseTicket(session);
      es = new EventSource(gameSseUrl(session, ticket));
      es.onmessage = (ev) => {
        errorCount = 0;
        try {
          const payload = JSON.parse(ev.data);
          if (payload?.gone) {
            gone.value = true;
            stopSse();
          } else {
            state.value = payload;
          }
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        stopSse();
        errorCount += 1;
        if (errorCount >= 4) {
          startPolling();
        } else {
          setTimeout(openSse, 800);
        }
      };
    } catch {
      startPolling();
    }
  }

  function stopSse(): void {
    if (es) {
      es.close();
      es = null;
    }
  }

  function startPolling(): void {
    if (pollTimer != null) return;
    pollTimer = window.setInterval(() => {
      void loadOnce();
    }, 4000);
  }

  function stopPolling(): void {
    if (pollTimer != null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  onMounted(async () => {
    await loadOnce();
    openSse();
  });
  onUnmounted(() => {
    stopped = true;
    stopSse();
    stopPolling();
  });

  return { state, gone };
}
