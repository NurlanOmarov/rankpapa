<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { api } from '../../api/client';

interface Notification {
  id: string;
  type: 'SANCTION' | 'INFO' | 'BILLING';
  message: string;
  readAt: string | null;
  createdAt: string;
}

const notifications = ref<Notification[]>([]);
const isOpen = ref(false);
const unreadCount = ref(0);

async function fetchNotifications() {
  try {
    const { data } = await api.get('/notifications');
    notifications.value = data;
    unreadCount.value = data.filter((n: Notification) => !n.readAt).length;
  } catch (err) {
    console.error('Failed to fetch notifications', err);
  }
}

async function markAsRead(id: string) {
  const n = notifications.value.find(x => x.id === id);
  if (n && !n.readAt) {
    await api.patch(`/notifications/${id}/read`);
    n.readAt = new Date().toISOString();
    unreadCount.value--;
  }
}

function toggle() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) fetchNotifications();
}

function close(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest('.notification-center')) isOpen.value = false;
}

onMounted(() => {
  fetchNotifications();
  window.addEventListener('click', close);
});

onUnmounted(() => {
  window.removeEventListener('click', close);
});

function getTypeIcon(type: string) {
  if (type === 'SANCTION') return '🚨';
  if (type === 'BILLING') return '💰';
  return 'ℹ️';
}

function formatTime(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <div class="relative notification-center">
    <button @click="toggle" class="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      <span v-if="unreadCount > 0" class="absolute top-1 right-1 block h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold border-2 border-white">
        {{ unreadCount }}
      </span>
    </button>

    <div v-if="isOpen" class="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
      <div class="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
        <h3 class="font-bold text-gray-900 text-sm">Уведомления</h3>
        <span class="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Последние 50</span>
      </div>

      <div class="max-h-96 overflow-y-auto">
        <div v-if="notifications.length === 0" class="p-8 text-center text-gray-400 text-xs italic">
          Уведомлений пока нет
        </div>
        <div
          v-for="n in notifications"
          :key="n.id"
          class="p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer relative"
          :class="{ 'opacity-60': n.readAt }"
          @click="markAsRead(n.id)"
        >
          <div class="flex gap-3">
            <span class="text-lg">{{ getTypeIcon(n.type) }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-700 leading-relaxed" :class="{ 'font-semibold': !n.readAt }">
                {{ n.message }}
              </p>
              <p class="text-[10px] text-gray-400 mt-1">{{ formatTime(n.createdAt) }}</p>
            </div>
          </div>
          <div v-if="!n.readAt" class="absolute top-4 right-4 h-1.5 w-1.5 rounded-full bg-blue-500"></div>
        </div>
      </div>
    </div>
  </div>
</template>
