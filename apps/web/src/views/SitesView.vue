<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';

const router = useRouter();
const sites = ref<unknown[]>([]);
const loading = ref(true);
const showAdd = ref(false);
const form = ref({ domain: '', geo: 'ALMATY', deviceType: 'MIXED' });
const saving = ref(false);

const geoOptions = [
  { value: 'ALMATY', label: 'Алматы' },
  { value: 'ASTANA', label: 'Астана' },
  { value: 'SHYMKENT', label: 'Шымкент' },
  { value: 'ALL', label: 'Весь Казахстан' },
];

const deviceOptions = [
  { value: 'MIXED', label: 'Смешанный (55% моб.)' },
  { value: 'MOBILE', label: 'Только мобильный' },
  { value: 'DESKTOP', label: 'Только десктоп' },
];

onMounted(async () => {
  try {
    const { data } = await api.get('/sites');
    sites.value = data;
  } finally {
    loading.value = false;
  }
});

async function addSite() {
  saving.value = true;
  try {
    const { data } = await api.post('/sites', form.value);
    sites.value.unshift(data);
    showAdd.value = false;
    form.value = { domain: '', geo: 'ALMATY', deviceType: 'MIXED' };
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-8">
    <div class="mb-8 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Мои сайты</h1>
      <button @click="showAdd = true" class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
        + Добавить сайт
      </button>
    </div>

    <!-- Add site modal -->
    <div v-if="showAdd" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl p-8 w-full max-w-md">
        <h2 class="text-xl font-bold text-gray-900 mb-6">Добавить сайт</h2>
        <form @submit.prevent="addSite" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Домен</label>
            <input v-model="form.domain" placeholder="example.kz" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Город</label>
            <select v-model="form.geo" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option v-for="opt in geoOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Тип устройств</label>
            <select v-model="form.deviceType" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option v-for="opt in deviceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <p class="text-xs text-amber-600 bg-amber-50 p-3 rounded-lg">
            ⚠️ Накрутка даёт результат только при уникальном контенте и нормальном E-E-A-T сайта
          </p>
          <div class="flex gap-3 pt-2">
            <button type="button" @click="showAdd = false" class="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">Отмена</button>
            <button type="submit" :disabled="saving" class="flex-1 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
              {{ saving ? 'Добавление...' : 'Добавить' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse h-20" />
    </div>

    <div v-else-if="sites.length === 0" class="bg-white rounded-2xl border border-gray-100 p-12 text-center">
      <p class="text-gray-500 mb-4">Нет добавленных сайтов</p>
      <button @click="showAdd = true" class="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
        Добавить первый сайт
      </button>
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="site in sites"
        :key="(site as { id: string }).id"
        class="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-between hover:shadow-sm transition-shadow cursor-pointer"
        @click="router.push(`/dashboard/sites/${(site as { id: string }).id}`)"
      >
        <div>
          <p class="font-semibold text-gray-900">{{ (site as { domain: string }).domain }}</p>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ (site as { geo: string }).geo }} · {{ (site as { deviceType: string }).deviceType }} ·
            <span :class="(site as { status: string }).status === 'ACTIVE' ? 'text-green-600' : 'text-gray-400'">
              {{ (site as { status: string }).status === 'ACTIVE' ? 'Активен' : 'Пауза' }}
            </span>
          </p>
        </div>
        <span class="text-gray-400 text-xl">›</span>
      </div>
    </div>
  </div>
</template>
