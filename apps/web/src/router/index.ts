import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Public
    { path: '/', component: () => import('../views/LandingView.vue') },
    { path: '/login', component: () => import('../views/LoginView.vue') },
    { path: '/register', component: () => import('../views/RegisterView.vue') },

    // Dashboard (requires auth)
    {
      path: '/dashboard',
      component: () => import('../layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', component: () => import('../views/DashboardView.vue') },
        { path: 'sites', component: () => import('../views/SitesView.vue') },
        { path: 'sites/:id', component: () => import('../views/SiteDetailView.vue') },
        { path: 'campaigns/new', component: () => import('../views/NewCampaignView.vue') },
        { path: 'campaigns/:id', component: () => import('../views/CampaignDetailView.vue') },
        { path: 'billing', component: () => import('../views/BillingView.vue') },
      ],
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.token) return '/login';
});

export default router;
