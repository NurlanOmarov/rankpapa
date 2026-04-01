<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api/client';
import VisitChart from '../components/dashboard/VisitChart.vue';

const stats = ref<{ 
  visitsToday: number; 
  visitsTotal: number; 
  trafficToday: number;
  trafficTotal: number;
  activeSites: number; 
  latestPositions: any[];
  chart: { data: number[]; labels: string[] };
} | null>(null);
const notifications = ref<any[]>([]);
const loading = ref(true);

const hasSanction = ref(false);

onMounted(async () => {
  try {
    const [statsRes, notifyRes] = await Promise.all([
      api.get('/stats/overview'),
      api.get('/notifications')
    ]);
    stats.value = statsRes.data;
    notifications.value = notifyRes.data;
    hasSanction.value = notifications.value.some(n => n.type === 'SANCTION' && !n.readAt);
  } finally {
    loading.value = false;
  }
});

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Обзор</h1>
        <p class="text-sm text-gray-500 mt-1">Статистика за сегодня</p>
      </div>
      <RouterLink to="/dashboard/sites" class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
        + Добавить сайт
      </RouterLink>
    </div>

    <!-- Sanction Alert Banner -->
    <div v-if="hasSanction" class="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 animate-pulse">
      <div class="h-10 w-10 bg-red-100 rounded-xl flex items-center justify-center text-xl">🚨</div>
      <div class="flex-1">
        <h3 class="text-sm font-bold text-red-900">Обнаружены санкции Google</h3>
        <p class="text-xs text-red-700 mt-0.5">Один или несколько ваших сайтов пропали из выдачи. Проверьте уведомления для подробностей.</p>
      </div>
      <RouterLink to="/dashboard/sites" class="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors">
        Подробнее
      </RouterLink>
    </div>

    <div v-if="loading" class="grid grid-cols-4 gap-6">
      <div v-for="i in 4" :key="i" class="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse h-28" />
    </div>

    <template v-else-if="stats">
      <div class="grid grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-2xl border border-gray-100 p-6">
          <p class="text-sm text-gray-500 mb-1">Визитов сегодня</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.visitsToday }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 p-6">
          <p class="text-sm text-gray-500 mb-1">Всего визитов</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.visitsTotal }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 p-6">
          <p class="text-sm text-gray-500 mb-1">Активных сайтов</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.activeSites }}</p>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 p-6">
          <p class="text-sm text-gray-500 mb-1">Трафик (сегодня)</p>
          <p class="text-3xl font-bold text-primary-600">{{ formatBytes(stats.trafficToday) }}</p>
          <p class="text-[10px] text-gray-400 mt-1">Всего: {{ formatBytes(stats.trafficTotal) }}</p>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <div class="flex items-center justify-between mb-6">
          <h2 class="font-semibold text-gray-900">Динамика визитов (7 дней)</h2>
          <span class="text-xs text-gray-400">Только успешные клики</span>
        </div>
        <VisitChart :data="stats.chart.data" :labels="stats.chart.labels" />
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 class="font-semibold text-gray-900 mb-4">Последние позиции</h2>
        <div v-if="stats.latestPositions.length === 0" class="text-sm text-gray-400 text-center py-8">
          Позиций пока нет. <RouterLink to="/dashboard/sites" class="text-primary-600 hover:underline">Добавьте сайт →</RouterLink>
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="(pos, i) in stats.latestPositions"
            :key="i"
            class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
          >
            <span class="text-sm text-gray-700">{{ (pos as { keyword: { keyword: string } }).keyword.keyword }}</span>
            <span class="text-sm font-medium px-2 py-0.5 rounded" :class="(pos as { position: number | null }).position && (pos as { position: number }).position <= 10 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'">
              {{ (pos as { position: number | null }).position ? `#${(pos as { position: number }).position}` : 'N/A' }}
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
