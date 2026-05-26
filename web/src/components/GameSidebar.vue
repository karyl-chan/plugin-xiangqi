<template>
  <div>
    <div class="player-card" :class="{ active: snapshot.sideToMove === 'black' && snapshot.status === 'active' }">
      <span class="badge black">黑</span>
      <span class="name">{{ snapshot.black.displayName }}</span>
      <span class="clock">{{ fmtClock(snapshot.black.remainingMs) }}</span>
    </div>
    <div class="player-card" :class="{ active: snapshot.sideToMove === 'red' && snapshot.status === 'active' }" style="margin-top:6px">
      <span class="badge red">紅</span>
      <span class="name">{{ snapshot.red.displayName }}</span>
      <span class="clock">{{ fmtClock(snapshot.red.remainingMs) }}</span>
    </div>

    <div v-if="snapshot.drawOffer" class="offer-card" style="margin-top:8px">
      <div>
        {{ snapshot.drawOffer.from === 'red' ? '紅' : '黑' }}方提議和棋。
      </div>
      <div class="action-row" v-if="canRespondToDraw">
        <AppButton variant="primary" size="sm" @click="$emit('draw-accept')">接受</AppButton>
        <AppButton variant="secondary" size="sm" @click="$emit('draw-decline')">拒絕</AppButton>
      </div>
      <div v-else-if="snapshot.drawOffer.from === snapshot.viewerRole" class="subtle">
        等待對手回應…
      </div>
    </div>
    <div v-if="snapshot.takebackOffer" class="offer-card" style="margin-top:8px">
      <div>
        {{ snapshot.takebackOffer.from === 'red' ? '紅' : '黑' }}方要求悔棋
        {{ snapshot.takebackOffer.plies }} 手。
      </div>
      <div class="action-row" v-if="canRespondToTakeback">
        <AppButton variant="primary" size="sm" @click="$emit('takeback-accept')">同意</AppButton>
        <AppButton variant="secondary" size="sm" @click="$emit('takeback-decline')">拒絕</AppButton>
      </div>
      <div v-else-if="snapshot.takebackOffer.from === snapshot.viewerRole" class="subtle">
        等待對手回應…
      </div>
    </div>

    <div class="action-row" v-if="snapshot.status === 'active' && snapshot.viewerRole !== 'spectator'">
      <AppButton variant="danger" size="sm" :disabled="busy" @click="$emit('resign')">投降</AppButton>
      <AppButton variant="secondary" size="sm" :disabled="busy || !!snapshot.drawOffer" @click="$emit('draw')">提和</AppButton>
      <AppButton variant="secondary" size="sm" :disabled="busy || !!snapshot.takebackOffer" @click="$emit('takeback')">悔棋</AppButton>
    </div>

    <h4 style="margin-top:16px">棋譜</h4>
    <div class="move-list">
      <div v-if="snapshot.history.length === 0" class="subtle">尚未走棋</div>
      <div v-for="(row, i) in pairs" :key="i" class="row">
        <span class="idx">{{ i + 1 }}.</span>
        <span>{{ row.red?.combined ?? "" }}</span>
        <span>{{ row.black?.combined ?? "" }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AppButton } from "@karyl-chan/ui";

interface SidebarSnapshot {
  status: string;
  viewerRole: "red" | "black" | "spectator";
  sideToMove: "red" | "black";
  red: { displayName: string; remainingMs: number | null };
  black: { displayName: string; remainingMs: number | null };
  history: Array<{ side: "red" | "black"; combined: string }>;
  drawOffer: { from: "red" | "black" } | null;
  takebackOffer: { from: "red" | "black"; plies: number } | null;
}

const props = defineProps<{ snapshot: SidebarSnapshot; busy?: boolean }>();
defineEmits<{
  (e: "resign"): void;
  (e: "draw"): void;
  (e: "takeback"): void;
  (e: "draw-accept"): void;
  (e: "draw-decline"): void;
  (e: "takeback-accept"): void;
  (e: "takeback-decline"): void;
}>();

const canRespondToDraw = computed(
  () =>
    props.snapshot.drawOffer != null &&
    props.snapshot.viewerRole !== "spectator" &&
    props.snapshot.drawOffer.from !== props.snapshot.viewerRole,
);
const canRespondToTakeback = computed(
  () =>
    props.snapshot.takebackOffer != null &&
    props.snapshot.viewerRole !== "spectator" &&
    props.snapshot.takebackOffer.from !== props.snapshot.viewerRole,
);

const pairs = computed(() => {
  const rows: Array<{ red?: { combined: string }; black?: { combined: string } }> = [];
  for (let i = 0; i < props.snapshot.history.length; i += 2) {
    rows.push({
      red: props.snapshot.history[i] ? { combined: props.snapshot.history[i].combined } : undefined,
      black: props.snapshot.history[i + 1] ? { combined: props.snapshot.history[i + 1].combined } : undefined,
    });
  }
  return rows;
});

function fmtClock(ms: number | null): string {
  if (ms == null) return "∞";
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
</script>
