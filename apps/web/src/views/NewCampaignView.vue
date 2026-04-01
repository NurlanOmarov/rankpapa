<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { api } from '../api/client';

const route = useRoute();
const router = useRouter();

interface Site { id: string; domain: string; geo: string }

const sites = ref<Site[]>([]);
const saving = ref(false);
const error = ref('');

const form = ref({
  siteId: (route.query.siteId as string) ?? '',
  type: 'PF_BOOST' as 'PF_BOOST' | 'POSITION_TRACKING',
  dailyVisitLimit: 100,
  dwellTimeMin: 60,
  dwellTimeMax: 180,
  pagesPerSession: 2,
  rampUpDays: 7,
  scheduleStart: 9,
  scheduleEnd: 22,
  keywords: [{ keyword: '', targetUrl: '' }],
});

onMounted(async () => {
  const { data } = await api.get('/sites');
  sites.value = data;
  if (!form.value.siteId && data.length > 0) form.value.siteId = data[0].id;
});

function addKeyword() {
  form.value.keywords.push({ keyword: '', targetUrl: '' });
}

function removeKeyword(i: number) {
  if (form.value.keywords.length > 1) form.value.keywords.splice(i, 1);
}

function parseKeywords(text: string) {
  const lines = text.trim().split('\n').filter(Boolean);
  form.value.keywords = lines.map(l => ({ keyword: l.trim(), targetUrl: '' }));
}

async function submit() {
  error.value = '';
  const validKeywords = form.value.keywords.filter(k => k.keyword.trim());
  if (!validKeywords.length) { error.value = 'Добавьте хотя бы один ключевой запрос'; return; }

  saving.value = true;
  try {
    const { data } = await api.post('/campaigns', {
      ...form.value,
      keywords: validKeywords.map(k => ({ keyword: k.keyword.trim(), targetUrl: k.targetUrl || undefined })),
    });
    router.push(`/dashboard/campaigns/${data.id}`);
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      ? JSON.stringify((e as { response: { data: { error: unknown } } }).response.data.error)
      : 'Ошибка при создании кампании';
  } finally {
    saving.value = false;
  }
}

const bulkText = ref('');
const showBulk = ref(false);

function applyBulk() {
  parseKeywords(bulkText.value);
  showBulk.value = false;
  bulkText.value = '';
}
</script>

<template>
  <div class="p-8 max-w-3xl">
    <RouterLink to="/dashboard/sites" class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
      ← Назад
    </RouterLink>

    <h1 class="text-2xl font-bold text-gray-900 mb-8">Новая кампания</h1>

    <form @submit.prevent="submit" class="space-y-8">
      <!-- Section: Site & Type -->
      <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <h2 class="font-semibold text-gray-900 text-base">Основные параметры</h2>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Сайт</label>
            <select v-model="form.siteId" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
              <option v-for="site in sites" :key="site.id" :value="site.id">{{ site.domain }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Тип кампании</label>
            <select v-model="form.type" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
              <option value="PF_BOOST">🚀 ПФ-буст (накрутка поведения)</option>
              <option value="POSITION_TRACKING">📍 Трекинг позиций</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Section: Schedule (only for PF_BOOST) -->
      <div v-if="form.type === 'PF_BOOST'" class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <h2 class="font-semibold text-gray-900 text-base">Расписание и объём</h2>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Визитов в день <span class="text-gray-400 font-normal">(10–2000)</span>
            </label>
            <input v-model.number="form.dailyVisitLimit" type="number" min="10" max="2000"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            <p class="text-xs text-amber-600 mt-1" v-if="form.dailyVisitLimit > 400">
              ⚠️ Рекомендуется не более 350–400/день на старте (чеклист #26)
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Рамп-ап дней</label>
            <input v-model.number="form.rampUpDays" type="number" min="1" max="30"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            <p class="text-xs text-gray-400 mt-1">Плавный рост с 80 до {{ form.dailyVisitLimit }}/день за {{ form.rampUpDays }} дн.</p>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Время на сайте мин (сек)</label>
            <input v-model.number="form.dwellTimeMin" type="number" min="30" max="600"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Время на сайте макс (сек)</label>
            <input v-model.number="form.dwellTimeMax" type="number" min="60" max="600"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Страниц за сессию</label>
            <input v-model.number="form.pagesPerSession" type="number" min="1" max="10"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Начало расписания (час)</label>
            <input v-model.number="form.scheduleStart" type="number" min="0" max="23"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Конец расписания (час)</label>
            <input v-model.number="form.scheduleEnd" type="number" min="0" max="23"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
        </div>
      </div>

      <!-- Section: Keywords -->
      <div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-gray-900 text-base">Ключевые запросы</h2>
          <div class="flex gap-2">
            <button
              type="button"
              @click="showBulk = !showBulk"
              class="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              📋 Массовый ввод
            </button>
            <button
              type="button"
              @click="addKeyword"
              class="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors"
            >
              + Добавить
            </button>
          </div>
        </div>

        <!-- Bulk input -->
        <div v-if="showBulk" class="space-y-2">
          <textarea
            v-model="bulkText"
            placeholder="трансферы алматы цена&#10;такси в аэропорт алматы&#10;трансфер астана"
            rows="5"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-mono resize-none"
          />
          <div class="flex gap-2">
            <button type="button" @click="applyBulk" class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors">
              Применить
            </button>
            <button type="button" @click="showBulk = false; bulkText = ''" class="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Отмена
            </button>
          </div>
        </div>

        <!-- Keywords list -->
        <div class="space-y-3">
          <div v-for="(kw, i) in form.keywords" :key="i" class="flex gap-2 items-start">
            <div class="flex-1 grid grid-cols-2 gap-2">
              <input
                v-model="kw.keyword"
                :placeholder="`Ключевой запрос ${i + 1}`"
                class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
              <input
                v-model="kw.targetUrl"
                placeholder="URL страницы (опционально)"
                class="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              />
            </div>
            <button
              type="button"
              @click="removeKeyword(i)"
              :disabled="form.keywords.length === 1"
              class="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors mt-0.5"
            >
              ✕
            </button>
          </div>
        </div>

        <p class="text-xs text-gray-400">{{ form.keywords.filter(k => k.keyword.trim()).length }} запрос(а) добавлено</p>
      </div>

      <!-- Error -->
      <p v-if="error" class="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{{ error }}</p>

      <!-- Submit -->
      <div class="flex gap-3">
        <RouterLink to="/dashboard/sites" class="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-center text-sm font-medium hover:bg-gray-50 transition-colors">
          Отмена
        </RouterLink>
        <button
          type="submit"
          :disabled="saving"
          class="flex-1 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
        >
          {{ saving ? 'Создание...' : 'Создать кампанию' }}
        </button>
      </div>
    </form>
  </div>
</template>
