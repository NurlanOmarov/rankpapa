<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

interface Transaction {
  id: string; amount: number; type: string; comment: string | null; createdAt: string;
}

const transactions = ref<Transaction[]>([]);
const loading = ref(true);
const topUpAmount = ref(50);
const topUpLoading = ref(false);
const showTopUp = ref(false);

onMounted(async () => {
  await auth.fetchMe();
  try {
    const { data } = await api.get('/billing/transactions');
    transactions.value = data;
  } finally {
    loading.value = false;
  }
});

const balance = computed(() => auth.user?.balance ?? 0);

const plans = [
  {
    id: 'START', name: 'Start', price: 29, color: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    features: ['500 визитов/день', '5 сайтов', '10 кампаний', 'Базовые сценарии', 'Email поддержка'],
  },
  {
    id: 'PRO', name: 'Pro', price: 79, color: 'border-primary-200 bg-primary-50',
    badge: 'bg-primary-100 text-primary-700',
    features: ['2000 визитов/день', '20 сайтов', 'Неограниченно кампаний', 'Все 9 сценариев', 'Трекинг позиций', 'Priority поддержка'],
  },
  {
    id: 'AGENCY', name: 'Agency', price: 199, color: 'border-purple-200 bg-purple-50',
    badge: 'bg-purple-100 text-purple-700',
    features: ['Без лимитов визитов', 'Неограниченно сайтов', 'White-label опции', 'API доступ', 'Выделенный менеджер'],
  },
];

function planLabel(plan: string) {
  const map: Record<string, string> = { FREE: 'Free', START: 'Start', PRO: 'Pro', AGENCY: 'Agency' };
  return map[plan] ?? plan;
}

async function selectPlan(planId: string) {
  // In a real system, this would redirect to Stripe checkout
  alert(`Переход на план ${planId} — интеграция с платёжной системой будет добавлена`);
}

async function topUp() {
  topUpLoading.value = true;
  try {
    // Stub: in real system — Stripe payment intent
    await api.post('/billing/topup', { amount: topUpAmount.value });
    await auth.fetchMe();
    showTopUp.value = false;
  } catch {
    alert('Пополнение временно недоступно. Свяжитесь с поддержкой.');
  } finally {
    topUpLoading.value = false;
  }
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function txIcon(type: string) {
  return type === 'DEPOSIT' ? '⬆️' : type === 'CHARGE' ? '⬇️' : '↩️';
}

function txColor(type: string) {
  return type === 'DEPOSIT' ? 'text-green-600' : type === 'CHARGE' ? 'text-red-500' : 'text-blue-500';
}
</script>

<template>
  <div class="p-8 max-w-4xl">
    <h1 class="text-2xl font-bold text-gray-900 mb-8">Баланс и тарифы</h1>

    <!-- Balance card -->
    <div class="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-6 text-white mb-8">
      <p class="text-sm text-primary-200 mb-1">Текущий баланс</p>
      <p class="text-4xl font-bold mb-3">${{ balance.toFixed(2) }}</p>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-primary-200">Текущий план</p>
          <p class="font-semibold">{{ planLabel(auth.user?.plan ?? 'FREE') }}</p>
        </div>
        <button
          @click="showTopUp = !showTopUp"
          class="px-5 py-2.5 bg-white text-primary-700 font-semibold rounded-xl text-sm hover:bg-primary-50 transition-colors"
        >
          + Пополнить
        </button>
      </div>
    </div>

    <!-- Top-up form -->
    <div v-if="showTopUp" class="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
      <h2 class="font-semibold text-gray-900 mb-4">Пополнение баланса</h2>
      <div class="flex gap-2 mb-4">
        <button
          v-for="amount in [20, 50, 100, 250]" :key="amount"
          @click="topUpAmount = amount"
          class="px-4 py-2 rounded-lg border text-sm font-medium transition-colors"
          :class="topUpAmount === amount ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'"
        >
          ${{ amount }}
        </button>
      </div>
      <div class="flex gap-3">
        <input
          v-model.number="topUpAmount" type="number" min="10" max="10000"
          class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          placeholder="Другая сумма"
        />
        <button
          @click="topUp"
          :disabled="topUpLoading"
          class="px-6 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors"
        >
          {{ topUpLoading ? 'Обработка...' : 'Пополнить $' + topUpAmount }}
        </button>
      </div>
    </div>

    <!-- Plans -->
    <div class="mb-8">
      <h2 class="font-semibold text-gray-900 mb-4">Тарифные планы</h2>
      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="plan in plans"
          :key="plan.id"
          class="rounded-2xl border-2 p-5 transition-all"
          :class="[plan.color, auth.user?.plan === plan.id ? 'ring-2 ring-primary-400' : '']"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-gray-900">{{ plan.name }}</h3>
            <span v-if="auth.user?.plan === plan.id" class="px-2 py-0.5 rounded-full text-xs font-medium" :class="plan.badge">
              Текущий
            </span>
          </div>
          <p class="text-2xl font-bold text-gray-900 mb-4">${{ plan.price }}<span class="text-sm font-normal text-gray-500">/мес</span></p>
          <ul class="space-y-2 mb-5">
            <li v-for="f in plan.features" :key="f" class="flex items-start gap-2 text-sm text-gray-700">
              <span class="text-green-500 mt-0.5">✓</span>{{ f }}
            </li>
          </ul>
          <button
            @click="selectPlan(plan.id)"
            :disabled="auth.user?.plan === plan.id"
            class="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
            :class="auth.user?.plan === plan.id
              ? 'bg-gray-200 text-gray-500 cursor-default'
              : 'bg-primary-600 text-white hover:bg-primary-700'"
          >
            {{ auth.user?.plan === plan.id ? 'Активен' : 'Выбрать' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Transaction history -->
    <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-50">
        <h2 class="font-semibold text-gray-900">История транзакций</h2>
      </div>

      <div v-if="loading" class="p-6 space-y-3">
        <div v-for="i in 4" :key="i" class="h-10 bg-gray-100 rounded-lg animate-pulse" />
      </div>

      <div v-else-if="transactions.length === 0" class="px-6 py-10 text-center text-sm text-gray-400">
        Транзакций пока нет
      </div>

      <div v-else class="divide-y divide-gray-50">
        <div
          v-for="tx in transactions"
          :key="tx.id"
          class="px-6 py-3.5 flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <span>{{ txIcon(tx.type) }}</span>
            <div>
              <p class="text-sm font-medium text-gray-900">{{ tx.comment ?? tx.type }}</p>
              <p class="text-xs text-gray-400">{{ formatDate(tx.createdAt) }}</p>
            </div>
          </div>
          <span class="font-semibold text-sm" :class="txColor(tx.type)">
            {{ tx.type === 'CHARGE' ? '-' : '+' }}${{ Math.abs(tx.amount).toFixed(2) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
