<template>
  <div>
    <div v-if="goneBanner" class="banner-aborted">對局已結束或已過保留期。</div>
    <div v-else-if="snapshot?.result" :class="resultBannerClass">
      {{ resultBanner }}
    </div>
    <div v-if="actionError" class="banner-aborted">{{ actionError }}</div>

    <div class="layout">
      <div class="panel">
        <XiangqiBoard v-if="snapshot" :snapshot="snapshot" @move="onMove" />
        <div v-else class="subtle">等待棋局狀態…</div>
      </div>
      <div class="panel">
        <GameSidebar
          v-if="snapshot"
          :snapshot="snapshot"
          :busy="actionBusy"
          @resign="onResign"
          @draw="onDraw"
          @takeback="onTakeback"
          @draw-accept="() => sendAction('draw-accept')"
          @draw-decline="() => sendAction('draw-decline')"
          @takeback-accept="() => sendAction('takeback-accept')"
          @takeback-decline="() => sendAction('takeback-decline')"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useGameBoard } from "../composables/use-game-board";
import { postGameAction, type GameSession } from "../api";
import XiangqiBoard from "../components/XiangqiBoard.vue";
import GameSidebar from "../components/GameSidebar.vue";

const props = defineProps<{ session: GameSession }>();
const { state, gone } = useGameBoard(props.session);

const snapshot = computed(() => state.value as any);
const goneBanner = computed(() => gone.value);

const actionBusy = ref(false);
const actionError = ref<string>("");

const resultBanner = computed(() => {
  const r = snapshot.value?.result;
  if (!r) return "";
  if (r.winner === "red") return "🔴 紅方勝";
  if (r.winner === "black") return "⚫ 黑方勝";
  if (r.reason === "draw_agreed" || r.reason === "halfmove_60") return "和棋";
  if (r.reason === "aborted") return "對局已中斷";
  return "對局結束";
});

const resultBannerClass = computed(() => {
  const r = snapshot.value?.result;
  if (!r) return "";
  if (r.winner) return "banner-win";
  if (r.reason === "aborted") return "banner-aborted";
  return "banner-draw";
});

async function onMove(from: { row: number; col: number }, to: { row: number; col: number }): Promise<void> {
  const move = `${"abcdefghi"[from.col]}${from.row}${"abcdefghi"[to.col]}${to.row}`;
  await postGameAction(props.session, { type: "move", move });
}

async function sendAction(type: string, confirmMessage?: string): Promise<void> {
  if (actionBusy.value) return;
  if (confirmMessage && !window.confirm(confirmMessage)) return;
  actionBusy.value = true;
  actionError.value = "";
  try {
    const resp = (await postGameAction(props.session, { type })) as { error?: string };
    if (resp && typeof resp === "object" && "error" in resp && resp.error) {
      actionError.value = resp.error;
    }
  } catch (err) {
    actionError.value = (err as Error).message || "請求失敗";
  } finally {
    actionBusy.value = false;
  }
}

function onResign(): void {
  void sendAction("resign", "確定要投降嗎？");
}
function onDraw(): void {
  void sendAction("draw-offer");
}
function onTakeback(): void {
  void sendAction("takeback-offer");
}
</script>
