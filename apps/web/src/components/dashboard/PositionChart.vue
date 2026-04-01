<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: (number | null)[];
  labels: string[];
  height?: number;
}>();

const chartHeight = props.height || 160;
const chartWidth = 800; // Relative units

// Filtering out nulls and determining range
const validPositions = computed(() => props.data.filter((v): v is number => v !== null));
const minPos = 1;
const maxPos = computed(() => Math.max(...validPositions.value, 100));

const points = computed(() => {
  if (props.data.length < 2) return [];
  const stepX = chartWidth / (props.data.length - 1);
  
  return props.data.map((val, i) => {
    if (val === null) return null;
    return {
      x: i * stepX,
      // Inverted Y: 1 is top (y=0), maxPos is bottom (y=chartHeight)
      y: ((val - minPos) / (maxPos.value - minPos)) * chartHeight,
      val
    };
  });
});

const pathData = computed(() => {
  const activePoints = points.value.filter((p): p is { x: number; y: number; val: number } => p !== null);
  if (activePoints.length < 2) return '';
  
  // We only draw lines between consecutive non-null points
  let path = '';
  let drawing = false;
  
  for (let i = 0; i < points.value.length; i++) {
    const p = points.value[i];
    if (p) {
      if (!drawing) {
        path += `M ${p.x} ${p.y} `;
        drawing = true;
      } else {
        path += `L ${p.x} ${p.y} `;
      }
    } else {
      drawing = false;
    }
  }
  return path;
});

const areaData = computed(() => {
  // Area fill is tricky with nulls. For now, let's keep it simple or skip it.
  // We'll skip complex area fill for positions to avoid weird shapes when data is missing.
  return '';
});
</script>

<template>
  <div class="relative w-full">
    <!-- Y-axis labels (optional, e.g. 1, 50, 100) -->
    <div class="absolute left-0 top-0 h-full flex flex-col justify-between text-[9px] text-gray-300 pointer-events-none pr-2 -translate-x-full">
      <span>1</span>
      <span>{{ Math.round(maxPos / 2) }}</span>
      <span>{{ maxPos }}</span>
    </div>

    <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="w-full h-auto overflow-visible">
      <!-- Grid lines -->
      <line x1="0" :y1="0" :x2="chartWidth" y2="0" stroke="#f1f5f9" stroke-width="1" />
      <line x1="0" :y1="chartHeight/2" :x2="chartWidth" :y2="chartHeight/2" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="4" />
      <line x1="0" :y1="chartHeight" :x2="chartWidth" :y2="chartHeight" stroke="#f1f5f9" stroke-width="1" />

      <!-- Line -->
      <path
        :d="pathData"
        fill="none"
        stroke="#8b5cf6"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Points -->
      <template v-for="(p, i) in points" :key="i">
        <circle
          v-if="p"
          :cx="p.x"
          :cy="p.y"
          r="3.5"
          fill="white"
          stroke="#8b5cf6"
          stroke-width="2"
        />
      </template>
    </svg>
    
    <div class="flex justify-between mt-3">
      <span v-for="(label, i) in labels" :key="i" class="text-[10px] text-gray-400 font-medium">
        {{ label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Custom purple theme for positions */
</style>
