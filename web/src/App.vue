<template>
  <div v-if="loading" class="panel">載入中…</div>
  <div v-else-if="mode === 'manage'">
    <ManageView :session="manageSession!" />
  </div>
  <div v-else-if="mode === 'game' && session">
    <GameBoardView :session="session" />
  </div>
  <div v-else class="panel">
    <h2>無法載入</h2>
    <p>此頁需要從 Discord 的 <span class="kbd">/xiangqi webui</span> 或 <span class="kbd">/xiangqi manage</span> 指令進入。</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  decodeJwtPayload,
  exchangeManageToken,
  loadGameSession,
  loadManageSession,
  readUrlParams,
  saveGameSession,
  saveManageSession,
  type GameSession,
  type ManageSession,
} from "./api";
import GameBoardView from "./views/GameBoardView.vue";
import ManageView from "./views/ManageView.vue";

const loading = ref(true);
const mode = ref<"game" | "manage" | null>(null);
const session = ref<GameSession | null>(null);
const manageSession = ref<ManageSession | null>(null);

onMounted(async () => {
  const url = readUrlParams();
  try {
    if (url.token) {
      // The token's `capabilities` claim tells us what flavour it is.
      const payload = decodeJwtPayload(url.token) as
        | { capabilities?: string[] }
        | null;
      const isManage =
        url.mode === "manage" ||
        (Array.isArray(payload?.capabilities) && (payload!.capabilities!.includes("admin") || payload!.capabilities!.some((c) => c.endsWith(":manage"))));
      if (isManage) {
        const exchanged = await exchangeManageToken(url.token);
        saveManageSession(exchanged);
        manageSession.value = exchanged;
        mode.value = "manage";
      } else if (url.c && url.s) {
        const s: GameSession = { token: url.token, channelId: url.c, sessionId: url.s };
        saveGameSession(s);
        session.value = s;
        mode.value = "game";
      }
    } else {
      // Restore from sessionStorage.
      const m = loadManageSession();
      if (m && m.refreshExpiresAt > Date.now()) {
        manageSession.value = m;
        mode.value = "manage";
      } else {
        const g = loadGameSession();
        if (g) {
          session.value = g;
          mode.value = "game";
        }
      }
    }
  } finally {
    loading.value = false;
  }
});
</script>
