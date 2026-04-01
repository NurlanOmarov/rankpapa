<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView, RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import NotificationCenter from '../components/dashboard/NotificationCenter.vue';

const auth = useAuthStore();
const router = useRouter();

const navItems = [
  { path: '/dashboard', label: 'Обзор', icon: '📊' },
  { path: '/dashboard/sites', label: 'Мои сайты', icon: '🌐' },
  { path: '/dashboard/billing', label: 'Баланс', icon: '💳' },
];

onMounted(() => auth.fetchMe());

function logout() {
  auth.logout();
  router.push('/');
}
</script>

<template>
  <div class="min-h-screen flex bg-gray-50">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div class="px-6 py-5 border-b">
        <RouterLink to="/dashboard" class="text-xl font-bold text-primary-600">RankPapa</RouterLink>
      </div>

      <nav class="flex-1 px-4 py-4 space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          active-class="bg-primary-50 text-primary-700"
        >
          <span class="text-lg">{{ item.icon }}</span>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="px-4 py-4 border-t">
        <div class="flex items-center justify-between mb-4">
          <div class="px-3 py-2">
            <p class="text-xs text-gray-500 truncate w-32">{{ auth.user?.email }}</p>
            <p class="text-sm font-medium text-gray-800 capitalize">{{ auth.user?.plan?.toLowerCase() }}</p>
          </div>
          <NotificationCenter />
        </div>
        <button
          @click="logout"
          class="w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          Выйти
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-auto">
      <RouterView />
    </main>
  </div>
</template>
