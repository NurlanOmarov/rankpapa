<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { api } from '../api/client';

const route = useRoute();
const router = useRouter();
const siteId = route.params.id as string;

interface Keyword { id: string; keyword: string; targetUrl?: string }
interface Campaign {
  id: string; type: string; status: string; dailyVisitLimit: number;
  dwellTimeMin: number; dwellTimeMax: number; rampUpDays: number;
  scheduleStart: number; scheduleEnd: number; createdAt: string;
  keywords: Keyword[];
  totalTraffic?: number;
}
interface Site { id: string; domain: string; geo: string; deviceType: string; status: string; campaigns: Campaign[] }

const site = ref<Site | null>(null);
const loading = ref(true);
const error = ref('');
const notifications = ref<any[]>([]);

const hasSanction = computed(() => {
  if (!site.value) return false;
  return notifications.value.some(n => 
    n.type === 'SANCTION' && 
    !n.readAt && 
    n.message.includes(site.value!.domain)
  );
});

const activeCampaigns = computed(() =>
  site.value?.campaigns.filter(c => c.status === 'ACTIVE') ?? []
);
const pausedCampaigns = computed(() =>
  site.value?.campaigns.filter(c => c.status !== 'ACTIVE') ?? []
);

onMounted(async () => {
  try {
    const [siteRes, notifyRes] = await Promise.all([
      api.get(`/sites/${siteId}`),
      api.get('/notifications')
    ]);
    site.value = siteRes.data;
    notifications.value = notifyRes.data;
  } catch {
    error.value = 'Сайт не найден';
  } finally {
    loading.value = false;
  }
});

async function toggleStatus() {
  if (!site.value) return;
  const newStatus = site.value.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  await api.patch(`/sites/${siteId}/status`, { status: newStatus });
  site.value.status = newStatus;
}

async function toggleCampaign(campaign: Campaign) {
  const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  await api.patch(`/campaigns/${campaign.id}/status`, { status: newStatus });
  campaign.status = newStatus;
}

function typeLabel(type: string) {
  return type === 'PF_BOOST' ? '🚀 ПФ-буст' : '📍 Трекинг позиций';
}

function geoLabel(geo: string) {
  const map: Record<string, string> = { ALMATY: 'Алматы', ASTANA: 'Астана', SHYMKENT: 'Шымкент', ALL: 'Весь KZ' };
  return map[geo] ?? geo;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
</script>

<template>
  <div class="p-8">
    <!-- Back -->
    <RouterLink to="/dashboard/sites" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
      ← Все сайты
    </RouterLink>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse h-28" />
      <div class="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse h-40" />
    </div>

    <div v-else-if="error" class="text-center py-20 text-gray-400">{{ error }}</div>

    <template v-else-if="site">
      <!-- Sanction Warning -->
      <div v-if="hasSanction" class="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-4 animate-pulse">
        <div class="h-10 w-10 bg-red-100 rounded-xl flex items-center justify-center text-xl">🚨</div>
        <div class="flex-1">
          <h3 class="text-sm font-bold text-red-900">Сайт не найден в поиске (Вероятный бан)</h3>
          <p class="text-xs text-red-700 mt-0.5">Google перестал показывать ваш сайт по всем отслеживаемым запросам. Кампания автоматически поставлена на паузу.</p>
        </div>
      </div>
      <!-- Site header -->
      <div class="bg-white rounded-2xl border border-gray-100 p-6 mb-6 flex items-start justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ site.domain }}</h1>
          <p class="text-sm text-gray-500 mt-1">
            {{ geoLabel(site.geo) }} · {{ site.deviceType === 'MIXED' ? 'Смешанный' : site.deviceType }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span
            class="px-3 py-1 rounded-full text-sm font-medium"
            :class="site.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
          >
            {{ site.status === 'ACTIVE' ? 'Активен' : 'Пауза' }}
          </span>
          <button
            @click="toggleStatus"
            class="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            {{ site.status === 'ACTIVE' ? 'Поставить на паузу' : 'Возобновить' }}
          </button>
        </div>
      </div>

      <!-- Campaigns header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Кампании</h2>
        <RouterLink
          :to="`/dashboard/campaigns/new?siteId=${siteId}`"
          class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Новая кампания
        </RouterLink>
      </div>

      <!-- Empty state -->
      <div v-if="site.campaigns.length === 0" class="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <p class="text-4xl mb-3">🚀</p>
        <p class="text-gray-600 font-medium mb-1">Нет кампаний</p>
        <p class="text-sm text-gray-400 mb-6">Создайте первую кампанию для начала накрутки ПФ или трекинга позиций</p>
        <RouterLink
          :to="`/dashboard/campaigns/new?siteId=${siteId}`"
          class="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          Создать кампанию
        </RouterLink>
      </div>

      <!-- Campaigns list -->
      <div v-else class="space-y-3">
        <div
          v-for="campaign in [...activeCampaigns, ...pausedCampaigns]"
          :key="campaign.id"
          class="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm transition-shadow"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 cursor-pointer" @click="router.push(`/dashboard/campaigns/${campaign.id}`)">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-semibold text-gray-900">{{ typeLabel(campaign.type) }}</span>
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                >
                  {{ campaign.status === 'ACTIVE' ? 'Активна' : 'Пауза' }}
                </span>
              </div>
              <div class="flex flex-wrap gap-3 text-xs text-gray-500">
                <span>📅 {{ campaign.dailyVisitLimit }} вит./день</span>
                <span>⏱ {{ campaign.dwellTimeMin }}–{{ campaign.dwellTimeMax }} сек</span>
                <span>🕐 {{ campaign.scheduleStart }}:00–{{ campaign.scheduleEnd }}:00</span>
                <span>🔤 {{ campaign.keywords.length }} ключ{{ campaign.keywords.length === 1 ? '' : 'ей' }}</span>
                <span class="text-primary-600 font-bold">📶 {{ formatBytes(campaign.totalTraffic) }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 ml-4">
              <button
                @click="toggleCampaign(campaign)"
                class="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {{ campaign.status === 'ACTIVE' ? 'Пауза' : 'Запустить' }}
              </button>
              <button
                @click="router.push(`/dashboard/campaigns/${campaign.id}`)"
                class="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors"
              >
                Детали →
              </button>
            </div>
          </div>

          <!-- Keywords preview -->
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span
              v-for="kw in campaign.keywords.slice(0, 6)"
              :key="kw.id"
              class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
            >
              {{ kw.keyword }}
            </span>
            <span v-if="campaign.keywords.length > 6" class="px-2 py-0.5 bg-gray-50 text-gray-400 rounded text-xs">
              +{{ campaign.keywords.length - 6 }} ещё
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
