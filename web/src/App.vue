<template>
  <div v-if="loading" class="panel">載入中…</div>
  <div v-else-if="mode === 'manage'">
    <ManageView />
  </div>
  <div v-else-if="mode === 'game' && session">
    <GameBoardView :session="session" />
  </div>
  <div v-else class="panel">
    <h2>無法載入</h2>
    <p v-if="deniedMessage">{{ deniedMessage }}</p>
    <p v-else>此頁需要從 Discord 的 <span class="kbd">/xiangqi webui</span> 或 <span class="kbd">/xiangqi manage</span> 指令進入。</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { bootstrapPluginSession } from "@karyl-chan/plugin-sdk/web";
import { setApi, type GameSession } from "./api";
import GameBoardView from "./views/GameBoardView.vue";
import ManageView from "./views/ManageView.vue";

const PLUGIN_KEY = "karyl-xiangqi";

const loading = ref(true);
const mode = ref<"game" | "manage" | null>(null);
const session = ref<GameSession | null>(null);
const deniedMessage = ref<string | null>(null);

onMounted(async () => {
  try {
    // Mode is decided by PATH, not token caps: the bot admin UI links to
    // `<base>/manage` (exchange → access/refresh pair); the `/xiangqi
    // webui` game link points at `<base>/?token=…&c=…&s=…` (direct
    // session bearer). Path is stable across tab reloads, so the manage
    // SPA resumes its refresh pair without re-inspecting any token.
    const wantsExchange = window.location.pathname
      .replace(/\/+$/, "")
      .endsWith("/manage");

    const handle = await bootstrapPluginSession({
      pluginKey: PLUGIN_KEY,
      exchangeJwt: wantsExchange,
      extraUrlParams: ["c", "s"],
      onAccessDenied: (msg) => {
        deniedMessage.value = msg || "存取遭拒，請重新取得連結。";
      },
    });
    setApi(handle.api);

    if (handle.denied || !handle.isAuthenticated) {
      return;
    }

    // Tab reload — SDK restored auth from sessionStorage but has no
    // decoded claims for us. Manage resumes cleanly (the pair survived);
    // game needs `?c=` / `?s=` which were stripped, so re-prompt.
    if (!handle.claims) {
      if (handle.hasRefreshPair) {
        mode.value = "manage";
      } else {
        deniedMessage.value =
          "重新整理遺失對局資訊，請重新執行 /xiangqi webui。";
      }
      return;
    }

    if (wantsExchange) {
      mode.value = "manage";
      return;
    }

    const channelId = handle.urlParams["c"];
    const sessionId = handle.urlParams["s"];
    if (!channelId || !sessionId) {
      deniedMessage.value =
        "對局連結缺少頻道資訊，請重新執行 /xiangqi webui。";
      return;
    }
    session.value = { channelId, sessionId };
    mode.value = "game";
  } finally {
    loading.value = false;
  }
});
</script>
