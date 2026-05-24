<template>
  <div class="panel">
    <h2>進行中對局</h2>
    <div v-if="loading" class="subtle">載入中…</div>
    <div v-else-if="games.length === 0" class="subtle">目前無對局</div>
    <div v-else>
      <div v-for="g in games" :key="g.sessionId" class="player-card" style="margin-bottom: 6px">
        <span>{{ g.red.displayName }} (紅) vs {{ g.black.displayName }} (黑)</span>
        <span class="subtle" style="margin-left:10px">channel {{ g.channelId }} · {{ g.plies }} 手</span>
        <button class="danger" style="margin-left:auto" @click="onStop(g.channelId)">強停</button>
      </div>
    </div>
    <button @click="refresh">重新整理</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  manageListGames,
  manageStopGame,
  refreshManageToken,
  saveManageSession,
  type ManageSession,
} from "../api";

const props = defineProps<{ session: ManageSession }>();
const session = ref<ManageSession>(props.session);
const loading = ref(true);
const games = ref<Array<{ sessionId: string; channelId: string; red: { displayName: string }; black: { displayName: string }; plies: number }>>([]);

async function withRefresh<T>(fn: (s: ManageSession) => Promise<T>): Promise<T> {
  try {
    return await fn(session.value);
  } catch (e) {
    if ((e as Error).message.includes("401")) {
      const refreshed = await refreshManageToken(session.value.refreshToken);
      saveManageSession(refreshed);
      session.value = refreshed;
      return fn(session.value);
    }
    throw e;
  }
}

async function refresh(): Promise<void> {
  loading.value = true;
  try {
    games.value = (await withRefresh((s) => manageListGames(s))) as typeof games.value;
  } catch (e) {
    console.warn(e);
  } finally {
    loading.value = false;
  }
}

async function onStop(channelId: string): Promise<void> {
  if (!confirm("確定要強制中斷此對局？")) return;
  await withRefresh((s) => manageStopGame(s, channelId));
  await refresh();
}

onMounted(refresh);
</script>
