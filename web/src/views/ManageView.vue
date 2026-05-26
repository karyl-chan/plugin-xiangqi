<template>
  <div class="panel">
    <h2>進行中對局</h2>
    <div v-if="loading" class="subtle">載入中…</div>
    <div v-else-if="games.length === 0" class="subtle">目前無對局</div>
    <div v-else>
      <div v-for="g in games" :key="g.sessionId" class="player-card" style="margin-bottom: 6px">
        <span>{{ g.red.displayName }} (紅) vs {{ g.black.displayName }} (黑)</span>
        <span class="subtle" style="margin-left:10px">channel {{ g.channelId }} · {{ g.plies }} 手</span>
        <AppButton variant="danger" size="sm" style="margin-left:auto" @click="onStop(g.channelId)">強停</AppButton>
      </div>
    </div>
    <AppButton variant="secondary" @click="refresh">重新整理</AppButton>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { AppButton } from "@karyl-chan/ui";
import { manageListGames, manageStopGame } from "../api";

// Access-token refresh is handled by the SDK's PluginApi wrapper —
// this view just calls the typed endpoints and lets the orchestrator
// retry transparently.

const loading = ref(true);
const games = ref<Array<{ sessionId: string; channelId: string; red: { displayName: string }; black: { displayName: string }; plies: number }>>([]);

async function refresh(): Promise<void> {
  loading.value = true;
  try {
    games.value = (await manageListGames()) as typeof games.value;
  } catch (e) {
    console.warn(e);
  } finally {
    loading.value = false;
  }
}

async function onStop(channelId: string): Promise<void> {
  if (!confirm("確定要強制中斷此對局？")) return;
  await manageStopGame(channelId);
  await refresh();
}

onMounted(refresh);
</script>
