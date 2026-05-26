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
const MANAGE_CAP_TOKEN = `plugin:${PLUGIN_KEY}:manage`;

const loading = ref(true);
const mode = ref<"game" | "manage" | null>(null);
const session = ref<GameSession | null>(null);
const deniedMessage = ref<string | null>(null);

function hasManageCaps(claims: { capabilities?: unknown } | null): boolean {
  const caps = Array.isArray(claims?.capabilities)
    ? (claims!.capabilities as string[])
    : [];
  return (
    caps.includes("admin") ||
    caps.includes(MANAGE_CAP_TOKEN) ||
    // Future-proof: keep the original "anything ending in :manage" sniff
    // so any other xiangqi-related manage cap still routes correctly.
    caps.some((c) => c.endsWith(":manage"))
  );
}

onMounted(async () => {
  try {
    // Xiangqi's link URLs don't carry `?surface=` — the bot CLI emits
    // a `/?token=…&c=…&s=…` link whose manage-vs-game intent is in the
    // JWT capabilities. Use SDK 0.5's `surfaceFromClaims` resolver to
    // derive surface from the token; SDK handles decode, manage
    // exchange, refresh, and sessionStorage restore.
    const handle = await bootstrapPluginSession({
      pluginKey: PLUGIN_KEY,
      surfaces: {
        manage: "manage",
        game: "session",
      },
      surfaceFromClaims: (claims) =>
        hasManageCaps(claims) ? "manage" : "game",
      extraUrlParams: ["c", "s"],
      onAccessDenied: (msg) => {
        deniedMessage.value = msg || "存取遭拒，請重新取得連結。";
      },
    });
    setApi(handle.api);

    if (handle.denied || handle.mode === "none") {
      return;
    }

    // Tab reload — SDK restored auth from sessionStorage but has no
    // decoded claims for us. Manage resumes cleanly; game needs the
    // channel + session ids from the URL (stripped, not stored).
    if (!handle.claims) {
      if (handle.mode === "manage") {
        mode.value = "manage";
      } else {
        deniedMessage.value =
          "重新整理遺失對局資訊，請重新執行 /xiangqi webui。";
      }
      return;
    }

    if (handle.surface === "manage") {
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
