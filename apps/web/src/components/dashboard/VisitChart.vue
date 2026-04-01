<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  data: number[];
  labels: string[];
  height?: number;
}>();

const maxHeight = computed(() => Math.max(...props.data, 1));
const chartHeight = props.height || 120;
const chartWidth = 600; // Relative units

const points = computed(() => {
  const stepX = chartWidth / (props.data.length - 1);
  return props.data.map((val, i) => ({
    x: i * stepX,
    y: chartHeight - (val / maxHeight.value) * chartHeight,
  }));
});

const pathData = computed(() => {
  if (points.value.length < 2) return '';
  return `M ${points.value[0].x} ${points.value[0].y} ` +
    points.value.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
});

const areaData = computed(() => {
  if (points.value.length < 2) return '';
  return `${pathData.value} L ${points.value[points.value.length - 1].x} ${chartHeight} L 0 ${chartHeight} Z`;
});
</script>

<template>
  <div class="w-full">
    <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="w-full h-auto overflow-visible">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-primary-500)" stop-opacity="0.3" />
          <stop offset="100%" stop-color="var(--color-primary-500)" stop-opacity="0" />
        </linearGradient>
      </defs>
      
      <!-- Area -->
      <path :d="areaData" fill="url(#chartGradient)" />
      
      <!-- Line -->
      <path
        :d="pathData"
        fill="none"
        stroke="var(--color-primary-600)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Points -->
      <circle
        v-for="(p, i) in points"
        :key="i"
        :cx="p.x"
        :cy="p.y"
        r="3"
        fill="white"
        stroke="var(--color-primary-600)"
        stroke-width="2"
      />
    </svg>
    
    <div class="flex justify-between mt-2">
      <span v-for="label in labels" :key="label" class="text-[10px] text-gray-400 font-medium">
        {{ label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.w-full {
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
}
</style>
