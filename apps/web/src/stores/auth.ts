import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api/client';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<{ id: string; email: string; name: string | null; plan: string; balance: number } | null>(null);

  const isLoggedIn = computed(() => !!token.value);

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
  }

  async function register(email: string, password: string, name?: string) {
    const { data } = await api.post('/auth/register', { email, password, name });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
  }

  async function fetchMe() {
    if (!token.value) return;
    const { data } = await api.get('/auth/me');
    user.value = data;
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
  }

  return { token, user, isLoggedIn, login, register, fetchMe, logout };
});
