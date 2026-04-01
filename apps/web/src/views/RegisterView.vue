<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const name = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.register(email.value, password.value, name.value || undefined);
    router.push('/dashboard');
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Ошибка регистрации';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <RouterLink to="/" class="block text-center text-xl font-bold text-primary-600 mb-8">RankPapa</RouterLink>
      <div class="bg-white rounded-2xl border border-gray-200 p-8">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Создать аккаунт</h1>
        <p class="text-sm text-gray-500 mb-6">7 дней бесплатного использования</p>
        <form @submit.prevent="submit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Имя (необязательно)</label>
            <input v-model="name" type="text" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input v-model="email" type="email" required class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
            <input v-model="password" type="password" required minlength="8" class="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
          <button type="submit" :disabled="loading" class="w-full py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {{ loading ? 'Регистрация...' : 'Создать аккаунт' }}
          </button>
        </form>
        <p class="mt-6 text-center text-sm text-gray-500">
          Уже есть аккаунт? <RouterLink to="/login" class="text-primary-600 font-medium hover:underline">Войти</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>
