<template>
  <div>
    <div v-if="goneBanner" class="banner-aborted">對局已結束或已過保留期。</div>
    <div v-else-if="snapshot?.result" :class="resultBannerClass">
      {{ resultBanner }}
    </div>
    <div v-if="actionError" class="banner-aborted">{{ actionError }}</div>

    <div class="layout">
      <div class="panel">
        <div v-if="snapshot" class="board-stage">
          <XiangqiBoard
            :snapshot="snapshot"
            :class="{ 'board-dimmed': paused }"
            @move="onMove"
          />
          <div v-if="paused" class="board-overlay">
            <div class="overlay-card">
              <div class="overlay-text">{{ pauseText }}</div>
              <div v-if="canRespond" class="overlay-actions">
                <AppButton variant="primary" size="sm" :disabled="actionBusy" @click="respondAccept">
                  {{ acceptLabel }}
                </AppButton>
                <AppButton variant="secondary" size="sm" :disabled="actionBusy" @click="respondDecline">
                  拒絕
                </AppButton>
              </div>
              <div v-else class="overlay-wait subtle">等待對手回應…</div>
            </div>
          </div>
        </div>
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
import { AppButton } from "@karyl-chan/ui";
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

// — pause overlay (a pending draw / takeback offer halts play) ──────────
function sideZh(side: "red" | "black"): string {
  return side === "red" ? "紅" : "黑";
}
const drawOffer = computed(() => snapshot.value?.drawOffer ?? null);
const takebackOffer = computed(() => snapshot.value?.takebackOffer ?? null);
const paused = computed(() => !!drawOffer.value || !!takebackOffer.value);
const viewerRole = computed(() => snapshot.value?.viewerRole ?? "spectator");

const pauseText = computed(() => {
  if (drawOffer.value) {
    return `${sideZh(drawOffer.value.from)}方提議和棋，接受或拒絕前無法繼續下棋。`;
  }
  if (takebackOffer.value) {
    return `${sideZh(takebackOffer.value.from)}方要求悔棋 ${takebackOffer.value.plies} 手，接受或拒絕前無法繼續下棋。`;
  }
  return "";
});
const acceptLabel = computed(() => (takebackOffer.value ? "同意" : "接受"));
const canRespond = computed(() => {
  const offer = drawOffer.value ?? takebackOffer.value;
  return (
    offer != null &&
    viewerRole.value !== "spectator" &&
    offer.from !== viewerRole.value
  );
});

function respondAccept(): void {
  void sendAction(drawOffer.value ? "draw-accept" : "takeback-accept");
}
function respondDecline(): void {
  void sendAction(drawOffer.value ? "draw-decline" : "takeback-decline");
}

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

<style scoped>
.board-stage {
  position: relative;
}
.board-dimmed {
  opacity: 0.3;
  filter: blur(1px);
  pointer-events: none;
  transition: opacity 0.15s ease;
}
.board-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  pointer-events: none;
}
.overlay-card {
  pointer-events: auto;
  max-width: 80%;
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 12px;
  padding: 18px 20px;
  text-align: center;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
}
.overlay-text {
  font-weight: 600;
  line-height: 1.5;
}
.overlay-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 14px;
}
.overlay-wait {
  margin-top: 12px;
}
</style>
