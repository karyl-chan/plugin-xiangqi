<template>
  <div class="board-wrap">
    <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="board-svg" preserveAspectRatio="xMidYMid meet">
      <!-- Board background. ONLY covers the playable region between the
           two file-label bands so the labels live on the parent's
           --panel background (high contrast, no overlap with end-row
           pieces). The label area at top and bottom is left transparent. -->
      <rect x="0" :y="LABEL_BAND" :width="WIDTH" :height="HEIGHT - 2 * LABEL_BAND" fill="var(--board)" />

      <!-- horizontal lines -->
      <line v-for="r in 10" :key="`h${r}`" :x1="X_MARGIN" :y1="rowY(r - 1)" :x2="WIDTH - X_MARGIN" :y2="rowY(r - 1)" stroke="var(--board-line)" stroke-width="1.2" />
      <!-- vertical lines (gap across river) -->
      <template v-for="c in 9" :key="`v${c}`">
        <line :x1="colX(c - 1)" :y1="rowY(0)" :x2="colX(c - 1)" :y2="rowY(4)" stroke="var(--board-line)" stroke-width="1.2" />
        <line :x1="colX(c - 1)" :y1="rowY(5)" :x2="colX(c - 1)" :y2="rowY(9)" stroke="var(--board-line)" stroke-width="1.2" />
      </template>
      <!-- side edges (continuous through river) -->
      <line :x1="X_MARGIN" :y1="rowY(0)" :x2="X_MARGIN" :y2="rowY(9)" stroke="var(--board-line)" stroke-width="1.2" />
      <line :x1="WIDTH - X_MARGIN" :y1="rowY(0)" :x2="WIDTH - X_MARGIN" :y2="rowY(9)" stroke="var(--board-line)" stroke-width="1.2" />
      <!-- palace diagonals -->
      <line :x1="colX(3)" :y1="rowY(0)" :x2="colX(5)" :y2="rowY(2)" stroke="var(--board-line)" stroke-width="1.2" />
      <line :x1="colX(5)" :y1="rowY(0)" :x2="colX(3)" :y2="rowY(2)" stroke="var(--board-line)" stroke-width="1.2" />
      <line :x1="colX(3)" :y1="rowY(7)" :x2="colX(5)" :y2="rowY(9)" stroke="var(--board-line)" stroke-width="1.2" />
      <line :x1="colX(5)" :y1="rowY(7)" :x2="colX(3)" :y2="rowY(9)" stroke="var(--board-line)" stroke-width="1.2" />
      <text :x="WIDTH / 4" :y="(rowY(4) + rowY(5)) / 2 + 8" text-anchor="middle" font-size="22" fill="var(--board-line)" font-weight="600">楚 河</text>
      <text :x="WIDTH * 3 / 4" :y="(rowY(4) + rowY(5)) / 2 + 8" text-anchor="middle" font-size="22" fill="var(--board-line)" font-weight="600">漢 界</text>

      <!-- Xiangqi-style file coordinates — Arabic 1-9 at the top
           (black's perspective, left→right) and Chinese 九-一 at the
           bottom (red's perspective, also displayed left→right which is
           red's right→left in column numbering). Matches the Discord
           board render. The labels render inside their own band painted
           with --panel so they get high contrast against the tan board
           AND can never be confused with cell content. Pointer-events
           disabled so the labels never swallow clicks. -->
      <g pointer-events="none">
        <text
          v-for="(label, ci) in BLACK_FILES"
          :key="`bf${ci}`"
          :x="colX(ci)"
          :y="flip ? HEIGHT - 8 : LABEL_BAND - 8"
          text-anchor="middle"
          font-size="18"
          font-weight="700"
          fill="var(--text)"
        >{{ label }}</text>
        <text
          v-for="(label, ci) in RED_FILES"
          :key="`rf${ci}`"
          :x="colX(ci)"
          :y="flip ? LABEL_BAND - 8 : HEIGHT - 8"
          text-anchor="middle"
          font-size="18"
          font-weight="700"
          fill="var(--text)"
        >{{ label }}</text>
      </g>

      <!-- selected square outline (drawn under pieces — just a frame) -->
      <rect v-if="selected" :x="colX(selected.col) - CELL/2" :y="rowY(selected.row) - CELL/2" :width="CELL" :height="CELL" fill="none" stroke="var(--accent)" stroke-width="2.5" rx="6" pointer-events="none" />

      <!-- pieces (no individual onclick — clicks land on the cell overlay below) -->
      <g v-for="(piece, idx) in pieceList" :key="`p${idx}`" :transform="`translate(${colX(piece.col)}, ${rowY(piece.row)})`" pointer-events="none">
        <circle :r="CELL * 0.42" fill="var(--piece-bg)" :stroke="piece.side === 'red' ? 'var(--piece-red)' : 'var(--piece-black)'" stroke-width="2" />
        <text text-anchor="middle" dominant-baseline="central" :font-size="CELL * 0.55" :fill="piece.side === 'red' ? 'var(--piece-red)' : 'var(--piece-black)'" font-weight="700">{{ glyphFor(piece) }}</text>
      </g>

      <!-- Legal-move markers — drawn ABOVE pieces so capture targets
           (which have an enemy piece on them) still get a visible ring.
           Solid dot for empty squares; thick ring for captures. -->
      <g v-if="selected">
        <template v-for="(t, i) in legalForSelected" :key="`hl${i}`">
          <circle
            v-if="!pieceAt(t.row, t.col)"
            :cx="colX(t.col)"
            :cy="rowY(t.row)"
            :r="CELL * 0.18"
            fill="var(--ok)"
            opacity="0.7"
            pointer-events="none"
          />
          <circle
            v-else
            :cx="colX(t.col)"
            :cy="rowY(t.row)"
            :r="CELL * 0.48"
            fill="none"
            stroke="var(--ok)"
            stroke-width="3"
            opacity="0.9"
            pointer-events="none"
          />
        </template>
      </g>

      <!-- ONE transparent click overlay per cell — sole click receiver.
           Drawn LAST so it sits on top of everything; pieces use
           pointer-events="none" so the overlay still hears their clicks. -->
      <rect
        v-for="(target, ti) in clickTargets"
        :key="`ct${ti}`"
        :x="colX(target.col) - CELL/2"
        :y="rowY(target.row) - CELL/2"
        :width="CELL"
        :height="CELL"
        fill="transparent"
        :style="interactive ? 'cursor: pointer' : ''"
        @click="onSquareClick(target.row, target.col)"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

interface PieceCell {
  row: number;
  col: number;
  side: "red" | "black";
  kind: string;
}

interface Snapshot {
  fen: string;
  sideToMove: "red" | "black";
  viewerRole: "red" | "black" | "spectator";
  legalMovesByFrom: Record<string, { row: number; col: number }[]>;
  status: string;
  drawOffer: { from: "red" | "black" } | null;
  takebackOffer: { from: "red" | "black"; plies: number } | null;
}

const props = defineProps<{ snapshot: Snapshot }>();
const emit = defineEmits<{
  (e: "move", from: { row: number; col: number }, to: { row: number; col: number }): void;
}>();

// Geometry. The viewBox is split into three horizontal regions:
//   [0, LABEL_BAND]                          — top file labels (1..9)
//   [LABEL_BAND, HEIGHT - LABEL_BAND]        — playable board (tan)
//   [HEIGHT - LABEL_BAND, HEIGHT]            — bottom file labels (九..一)
// Y_MARGIN is chosen so the first/last rank's piece radius doesn't bleed
// into the label band:   Y_MARGIN >= LABEL_BAND + PIECE_RADIUS + cushion.
const WIDTH = 540;
const HEIGHT = 660;
const X_MARGIN = 30;
const Y_MARGIN = 60;
const LABEL_BAND = 28;
const CELL = (WIDTH - 2 * X_MARGIN) / 8;         // = 60
const ROW_GAP = (HEIGHT - 2 * Y_MARGIN) / 9;     // = 60 (square cells)

const BLACK_FILES = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const RED_FILES = ["九", "八", "七", "六", "五", "四", "三", "二", "一"];

// Black plays from the far side, so rotate the whole board 180° for the
// black viewer: their pieces sit at the bottom, like red's do for red.
// Glyphs stay upright (we mirror the coordinate mapping, not the SVG), so
// only colX/rowY + the file-label bands need to know about the flip.
const flip = computed(() => props.snapshot?.viewerRole === "black");

function colX(col: number): number {
  return X_MARGIN + (flip.value ? 8 - col : col) * CELL;
}
function rowY(row: number): number {
  return Y_MARGIN + (flip.value ? row : 9 - row) * ROW_GAP;
}

const GLYPHS = {
  red: { king: "帥", advisor: "仕", elephant: "相", horse: "傌", chariot: "俥", cannon: "炮", pawn: "兵" },
  black: { king: "將", advisor: "士", elephant: "象", horse: "馬", chariot: "車", cannon: "砲", pawn: "卒" },
};
function glyphFor(p: PieceCell): string {
  const map = GLYPHS[p.side] as Record<string, string>;
  return map[p.kind] ?? "?";
}

const pieceList = computed<PieceCell[]>(() => {
  if (!props.snapshot?.fen) return [];
  const placement = props.snapshot.fen.split(" ")[0];
  const ranks = placement.split("/");
  if (ranks.length !== 10) return [];
  const out: PieceCell[] = [];
  for (let i = 0; i < 10; i++) {
    const row = 9 - i;
    let col = 0;
    for (const ch of ranks[i]) {
      if (/[1-9]/.test(ch)) {
        col += parseInt(ch, 10);
      } else {
        const isRed = ch === ch.toUpperCase();
        const kindMap: Record<string, string> = {
          k: "king", a: "advisor", b: "elephant", n: "horse", r: "chariot", c: "cannon", p: "pawn",
        };
        const kind = kindMap[ch.toLowerCase()];
        if (kind) out.push({ row, col, side: isRed ? "red" : "black", kind });
        col++;
      }
    }
  }
  return out;
});

const selected = ref<{ row: number; col: number } | null>(null);

// A pending draw/takeback offer pauses the game — no moves until it's
// resolved. (GameBoardView also dims the board + blocks pointer events,
// but gate here too so a stray click can never slip a move through.)
const paused = computed(
  () => props.snapshot?.drawOffer != null || props.snapshot?.takebackOffer != null,
);

const interactive = computed(
  () =>
    props.snapshot?.status === "active" &&
    !paused.value &&
    props.snapshot?.viewerRole !== "spectator" &&
    props.snapshot?.viewerRole === props.snapshot?.sideToMove,
);

const legalForSelected = computed<{ row: number; col: number }[]>(() => {
  if (!selected.value) return [];
  return props.snapshot.legalMovesByFrom?.[`${selected.value.row},${selected.value.col}`] ?? [];
});

const clickTargets = computed<{ row: number; col: number }[]>(() => {
  const out: { row: number; col: number }[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) out.push({ row: r, col: c });
  }
  return out;
});

watch(
  () => props.snapshot,
  () => {
    selected.value = null;
  },
);

function pieceAt(row: number, col: number): PieceCell | null {
  return pieceList.value.find((p) => p.row === row && p.col === col) ?? null;
}

/**
 * Single click handler. Handles all three transitions:
 *  1. No selection + clicked own piece with legal moves → select it.
 *  2. Selection + clicked one of its legal targets → emit move.
 *  3. Selection + clicked another own piece → switch selection.
 *  4. Selection + clicked elsewhere → deselect.
 */
function onSquareClick(row: number, col: number): void {
  if (!interactive.value) return;

  if (selected.value) {
    const moves =
      props.snapshot.legalMovesByFrom?.[`${selected.value.row},${selected.value.col}`] ?? [];
    if (moves.some((m) => m.row === row && m.col === col)) {
      emit("move", { ...selected.value }, { row, col });
      selected.value = null;
      return;
    }
  }
  const piece = pieceAt(row, col);
  if (piece && piece.side === props.snapshot.viewerRole) {
    const myMoves = props.snapshot.legalMovesByFrom?.[`${row},${col}`];
    if (myMoves && myMoves.length > 0) {
      selected.value = { row, col };
      return;
    }
  }
  selected.value = null;
}
</script>

<style scoped>
.board-wrap {
  background: var(--panel);
  border-radius: 10px;
  padding: 10px;
}
.board-svg {
  display: block;
  width: 100%;
  height: auto;
}
</style>
