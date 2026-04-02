<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { api } from '../api/client';
import PositionChart from '../components/dashboard/PositionChart.vue';

const route = useRoute();
const router = useRouter();
const campaignId = route.params.id as string;

interface Visit {
  id: string; createdAt: string; status: string;
  dwellSeconds: number | null; clickPosition: number | null; pagesVisited: number;
}
interface Keyword { id: string; keyword: string; targetUrl?: string; visits: Visit[] }
interface Site { domain: string; geo: string }
interface Campaign {
  id: string; type: string; status: string; dailyVisitLimit: number;
  dwellTimeMin: number; dwellTimeMax: number; rampUpDays: number;
  scheduleStart: number; scheduleEnd: number; createdAt: string;
  keywords: Keyword[]; site: Site;
}

interface Position { position: number | null; checkedAt: string }
interface KeywordWithPos extends Keyword { positions: Position[] }
interface CampaignWithPos extends Omit<Campaign, 'keywords'> { keywords: KeywordWithPos[] }

const campaign = ref<CampaignWithPos | null>(null);
const loading = ref(true);
const togglingStatus = ref(false);

// Queue status
const queueStatus = ref<{ waiting: number; active: number; completed: number; failed: number; total: number } | null>(null);
const runJobIds = ref<string[]>([]);
const isWorking = computed(() => (queueStatus.value?.waiting ?? 0) + (queueStatus.value?.active ?? 0) > 0);
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchQueueStatus() {
  try {
    const ids = runJobIds.value.join(',');
    const url = ids
      ? `/campaigns/${campaignId}/jobs-status?ids=${ids}`
      : `/campaigns/${campaignId}/queue-status`;
    const { data } = await api.get(url);
    queueStatus.value = data;
    if (!isWorking.value && pollTimer) {
      // Refresh campaign data once jobs are done
      const { data: cam } = await api.get(`/campaigns/${campaignId}`);
      campaign.value = cam;
      clearInterval(pollTimer);
      pollTimer = null;
    }
  } catch { /* ignore */ }
}

function startPolling() {
  if (pollTimer) return;
  fetchQueueStatus();
  pollTimer = setInterval(async () => {
    await fetchQueueStatus();
    // Also refresh campaign data every tick to show updated visits/positions
    const { data: cam } = await api.get(`/campaigns/${campaignId}`);
    campaign.value = cam;
  }, 3000);
}

onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });

// Period filtering
const selectedPeriod = ref(7); // default 7 days
const keywordHistories = ref<Record<string, any[]>>({});
const loadingHistory = ref<Record<string, boolean>>({});
const expandedGraphs = ref<Record<string, boolean>>({});

async function toggleGraph(kwId: string) {
  expandedGraphs.value[kwId] = !expandedGraphs.value[kwId];
  if (expandedGraphs.value[kwId] && !keywordHistories.value[kwId]) {
    await fetchHistory(kwId);
  }
}

async function fetchHistory(kwId: string) {
  loadingHistory.value[kwId] = true;
  try {
    const { data } = await api.get(`/stats/positions/${kwId}`, {
         params: { days: selectedPeriod.value === 0 ? undefined : selectedPeriod.value }
    });
    keywordHistories.value[kwId] = data;
  } finally {
    loadingHistory.value[kwId] = false;
  }
}

async function updateAllHistories() {
    // Re-fetch only currently expanded graphs
    for (const kwId in expandedGraphs.value) {
        if (expandedGraphs.value[kwId]) {
            await fetchHistory(kwId);
        }
    }
}

function getChartLabels(history: any[]) {
    return history.map(h => new Date(h.checkedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
}

function getChartData(history: any[]) {
    return history.map(h => h.position);
}

// Stats derived from visits
const allVisits = computed(() =>
  (campaign.value?.keywords ?? []).flatMap(k => k.visits)
);
const successVisits = computed(() =>
  allVisits.value.filter(v => v.status === 'SUCCESS')
);
const avgDwell = computed(() => {
  const vals = successVisits.value.map(v => v.dwellSeconds).filter(Boolean) as number[];
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
});
const avgPosition = computed(() => {
  const positions = (campaign.value?.keywords ?? [])
    .flatMap(k => k.visits.filter(v => v.clickPosition != null).map(v => v.clickPosition!));
  if (!positions.length) return null;
  return Math.round(positions.reduce((a, b) => a + b, 0) / positions.length);
});

onMounted(async () => {
  try {
    const { data } = await api.get(`/campaigns/${campaignId}`);
    campaign.value = data;
  } finally {
    loading.value = false;
  }
});

async function toggleStatus() {
  if (!campaign.value) return;
  togglingStatus.value = true;
  try {
    const newStatus = campaign.value.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await api.patch(`/campaigns/${campaignId}/status`, { status: newStatus });
    campaign.value.status = newStatus;
  } finally {
    togglingStatus.value = false;
  }
}

const running = ref(false);

async function runNow() {
  running.value = true;
  try {
    const { data } = await api.post(`/campaigns/${campaignId}/run`);
    runJobIds.value = data.jobIds ?? [];
    startPolling();
  } catch {
    alert('Ошибка при запуске');
  } finally {
    running.value = false;
  }
}

async function deleteCampaign() {
  if (!confirm('Удалить кампанию? Это действие нельзя отменить.')) return;
  await api.delete(`/campaigns/${campaignId}`);
  router.back();
}

// Keyword management
const showAddKeywords = ref(false);
const newKeywordsText = ref('');
const addingKeywords = ref(false);

async function addKeywords() {
  if (!newKeywordsText.value.trim()) return;
  const lines = newKeywordsText.value.split('\n').map(l => l.trim()).filter(Boolean);
  const keywords = lines.map(l => ({ keyword: l }));
  addingKeywords.value = true;
  try {
    const { data } = await api.post(`/campaigns/${campaignId}/keywords`, { keywords });
    if (campaign.value) {
      campaign.value.keywords.push(...data.map((kw: any) => ({ ...kw, visits: [], positions: [] })));
    }
    newKeywordsText.value = '';
    showAddKeywords.value = false;
  } catch {
    alert('Ошибка при добавлении ключей');
  } finally {
    addingKeywords.value = false;
  }
}

async function deleteKeyword(kwId: string) {
  if (!confirm('Удалить этот ключевой запрос?')) return;
  await api.delete(`/campaigns/${campaignId}/keywords/${kwId}`);
  if (campaign.value) {
    campaign.value.keywords = campaign.value.keywords.filter(k => k.id !== kwId);
  }
}

function visitStatusClass(status: string) {
  const map: Record<string, string> = {
    SUCCESS: 'text-green-600',
    FAILED: 'text-red-500',
    CAPTCHA: 'text-orange-500',
    NOT_FOUND: 'text-gray-400',
  };
  return map[status] ?? 'text-gray-400';
}

function visitStatusLabel(status: string) {
  const map: Record<string, string> = {
    SUCCESS: '✓', FAILED: '✗', CAPTCHA: '🤖', NOT_FOUND: '?',
  };
  return map[status] ?? '?';
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const typeLabel = (type: string) => type === 'PF_BOOST' ? '🚀 ПФ-буст' : '📍 Трекинг позиций';
</script>

<template>
  <div class="p-8">
    <RouterLink to="/dashboard/sites" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
      ← Назад
    </RouterLink>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse h-32" />
      <div class="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse h-48" />
    </div>

    <template v-else-if="campaign">
      <!-- Header -->
      <div class="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3 mb-1">
              <h1 class="text-xl font-bold text-gray-900">{{ typeLabel(campaign.type) }}</h1>
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-medium"
                :class="campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
              >
                {{ campaign.status === 'ACTIVE' ? 'Активна' : 'Пауза' }}
              </span>
            </div>
            <p class="text-sm text-gray-500">{{ campaign.site.domain }}</p>
          </div>
          <div class="flex gap-2">
            <!-- Period Selector -->
            <div class="flex bg-gray-50 p-1 rounded-lg mr-4 border border-gray-100">
                <button
                    v-for="p in [7, 30, 0]"
                    :key="p"
                    @click="selectedPeriod = p; updateAllHistories()"
                    class="px-3 py-1 text-xs font-medium rounded-md transition-all"
                    :class="selectedPeriod === p ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'"
                >
                    {{ p === 0 ? 'Все время' : p + 'д' }}
                </button>
            </div>

            <button
              @click="runNow"
              :disabled="running || isWorking || campaign.status !== 'ACTIVE'"
              class="px-4 py-2 border border-blue-200 rounded-lg text-sm text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-60"
            >
              {{ isWorking ? '⏳ В работе...' : running ? 'Запускаю...' : '▶ Запустить сейчас' }}
            </button>
            <button
              @click="toggleStatus"
              :disabled="togglingStatus || (campaign.status === 'ACTIVE' && !isWorking)"
              class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              {{ campaign.status === 'ACTIVE' ? 'Поставить на паузу' : 'Запустить' }}
            </button>
            <button
              @click="deleteCampaign"
              class="px-4 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              Удалить
            </button>
          </div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-50">
          <template v-if="campaign.type === 'PF_BOOST'">
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Визитов всего</p>
              <p class="text-2xl font-bold text-gray-900">{{ successVisits.length }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Ср. время (сек)</p>
              <p class="text-2xl font-bold text-gray-900">{{ avgDwell || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Ср. позиция клика</p>
              <p class="text-2xl font-bold text-gray-900">{{ avgPosition ? `#${avgPosition}` : '—' }}</p>
            </div>
          </template>
          <template v-else>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Проверок позиций</p>
              <p class="text-2xl font-bold text-gray-900">{{ campaign.keywords.flatMap(k => (k as any).positions ?? []).length || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Тип</p>
              <p class="text-2xl font-bold text-gray-900">Еженедельно</p>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-0.5">Расписание</p>
              <p class="text-2xl font-bold text-gray-900">Пн 08:00</p>
            </div>
          </template>
          <div>
            <p class="text-xs text-gray-400 mb-0.5">Ключей</p>
            <p class="text-2xl font-bold text-gray-900">{{ campaign.keywords.length }}</p>
          </div>
        </div>
      </div>

      <!-- Queue progress bar -->
      <div v-if="isWorking && queueStatus" class="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-3 mb-6 flex items-center gap-4">
        <span class="text-sm text-blue-700 font-medium animate-pulse">⏳ Идёт обработка</span>
        <div class="flex-1 bg-blue-100 rounded-full h-2">
          <div
            class="bg-blue-500 h-2 rounded-full transition-all duration-500"
            :style="{ width: queueStatus.total ? `${Math.min(100, Math.round((queueStatus.completed + queueStatus.failed) / queueStatus.total * 100))}%` : '0%' }"
          />
        </div>
        <span class="text-xs text-blue-500 whitespace-nowrap">
          {{ queueStatus.completed }}/{{ queueStatus.total }} готово
          <template v-if="queueStatus.active"> · {{ queueStatus.active }} активных</template>
          <template v-if="queueStatus.failed"> · <span class="text-red-400">{{ queueStatus.failed }} ошибок</span></template>
        </span>
      </div>

      <!-- Config card (PF_BOOST only) -->
      <div v-if="campaign.type === 'PF_BOOST'" class="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <h2 class="font-semibold text-gray-900 mb-3 text-sm">Настройки</h2>
        <div class="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>📅 {{ campaign.dailyVisitLimit }} визит./день</span>
          <span>⏱ {{ campaign.dwellTimeMin }}–{{ campaign.dwellTimeMax }} сек</span>
          <span>📄 {{ campaign.pagesPerSession }} стр./сессию</span>
          <span>📈 Рамп-ап {{ campaign.rampUpDays }} дн.</span>
          <span>🕐 {{ campaign.scheduleStart }}:00–{{ campaign.scheduleEnd }}:00</span>
        </div>
      </div>

      <!-- Keywords + visits -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-gray-900">Ключевые запросы</h2>
          <button
            v-if="campaign.type === 'POSITION_TRACKING'"
            @click="showAddKeywords = !showAddKeywords"
            class="px-3 py-1.5 text-xs font-medium border border-primary-200 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          >
            {{ showAddKeywords ? 'Отмена' : '+ Добавить ключи' }}
          </button>
        </div>

        <!-- Add keywords form -->
        <div v-if="showAddKeywords" class="bg-white rounded-2xl border border-primary-100 p-5">
          <p class="text-xs text-gray-500 mb-2">Введите ключевые запросы — по одному на строку</p>
          <textarea
            v-model="newKeywordsText"
            rows="4"
            placeholder="медицинские двери&#10;стальные двери алматы&#10;купить дверь"
            class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
          <div class="flex justify-end mt-3">
            <button
              @click="addKeywords"
              :disabled="addingKeywords || !newKeywordsText.trim()"
              class="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors"
            >
              {{ addingKeywords ? 'Добавляю...' : 'Добавить' }}
            </button>
          </div>
        </div>

        <div v-for="kw in campaign.keywords" :key="kw.id" class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div class="px-5 py-4 flex items-center justify-between border-b border-gray-50">
            <div>
              <p class="font-medium text-gray-900 text-sm">{{ kw.keyword }}</p>
              <p v-if="kw.targetUrl" class="text-xs text-gray-400 mt-0.5">{{ kw.targetUrl }}</p>
            </div>
            <div class="flex items-center gap-3">
              <template v-if="campaign.type === 'POSITION_TRACKING'">
                <span v-if="(kw as any).positions?.[0]" class="text-sm font-semibold" :class="(kw as any).positions[0].position ? 'text-green-600' : 'text-gray-400'">
                  {{ (kw as any).positions[0].position ? `#${(kw as any).positions[0].position}` : 'не найден' }}
                </span>
                <span v-else-if="isWorking" class="text-xs text-blue-400 animate-pulse">проверяется...</span>
                <span v-else class="text-xs text-gray-300">нет данных</span>
              </template>
              <span v-else class="text-xs text-gray-400">{{ kw.visits.length }} визитов</span>
              <button
                @click="toggleGraph(kw.id)"
                class="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-100 hover:bg-gray-50 transition-colors"
                :class="expandedGraphs[kw.id] ? 'bg-primary-50 text-primary-600 border-primary-100' : 'text-gray-400'"
              >
                {{ expandedGraphs[kw.id] ? 'Скрыть график' : 'История позиций' }}
              </button>
              <button
                v-if="campaign.type === 'POSITION_TRACKING'"
                @click="deleteKeyword(kw.id)"
                class="px-2 py-1 text-[10px] text-red-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors"
                title="Удалить ключ"
              >✕</button>
            </div>
          </div>

          <!-- Position History Chart -->
          <div v-if="expandedGraphs[kw.id]" class="px-5 py-6 bg-gray-50/30 border-b border-gray-50">
            <div v-if="loadingHistory[kw.id]" class="h-32 flex items-center justify-center">
                <span class="text-xs text-gray-400 animate-pulse">Загрузка данных...</span>
            </div>
            <div v-else-if="keywordHistories[kw.id]?.length > 1">
                <PositionChart
                    :data="getChartData(keywordHistories[kw.id])"
                    :labels="getChartLabels(keywordHistories[kw.id])"
                />
            </div>
            <div v-else class="text-center py-4 text-xs text-gray-400 italic">
                Недостаточно данных для графика за этот период
            </div>
          </div>

          <!-- Visits mini-table -->
          <div v-if="kw.visits.length > 0" class="divide-y divide-gray-50">
            <div
              v-for="visit in kw.visits.slice(0, 8)"
              :key="visit.id"
              class="px-5 py-2.5 flex items-center gap-4 text-xs text-gray-600"
            >
              <span :class="visitStatusClass(visit.status)" class="w-4 text-center font-bold">
                {{ visitStatusLabel(visit.status) }}
              </span>
              <span class="text-gray-400 w-28">{{ formatDate(visit.createdAt) }}</span>
              <span v-if="visit.dwellSeconds">⏱ {{ visit.dwellSeconds }}с</span>
              <span v-if="visit.clickPosition">📍 #{{ visit.clickPosition }}</span>
              <span v-if="visit.pagesVisited > 1">📄 {{ visit.pagesVisited }} стр.</span>
            </div>
          </div>
          <div v-else class="px-5 py-4 text-xs text-gray-400">
            {{ campaign.type === 'PF_BOOST' ? 'Визитов пока нет — воркер запустит их по расписанию' : 'Позиции проверяются еженедельно по понедельникам в 08:00 — нажмите «История позиций»' }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
