<script setup lang="ts">
import { RouterLink } from 'vue-router';

const steps = [
  { num: '01', title: 'Добавьте сайт', desc: 'Укажите домен, город и ключевые слова для продвижения' },
  { num: '02', title: 'Настройте кампанию', desc: 'Выберите объём трафика, расписание и режим рамп-ап' },
  { num: '03', title: 'Запустите', desc: 'Система генерирует реальные визиты из Google.kz 24/7' },
  { num: '04', title: 'Наблюдайте рост', desc: 'Отслеживайте позиции и статистику в личном кабинете' },
];

const features = [
  { icon: '🇰🇿', title: 'KZ residential прокси', desc: 'Только казахстанские IP из Алматы, Астаны и Шымкента' },
  { icon: '🖥️', title: 'Реальные fingerprints', desc: 'Уникальный браузерный профиль для каждого визита' },
  { icon: '🤖', title: 'Human-like поведение', desc: 'Bezier-мышь, скролл, взаимодействие с элементами сайта' },
  { icon: '📈', title: 'Ramp-up режим', desc: 'Плавное наращивание трафика — без подозрительных всплесков' },
  { icon: '📍', title: 'Гео-таргетинг', desc: 'Выдача с позиции реального пользователя из нужного города' },
  { icon: '📊', title: 'Трекинг позиций', desc: 'Ежедневный мониторинг ваших ключей и конкурентов' },
];

const plans = [
  {
    name: 'Старт', price: '5 000', currency: '₸/мес',
    features: ['10 ключей', '1 500 визитов/мес', '1 город', 'Базовая статистика'],
    cta: 'Начать',
  },
  {
    name: 'Профи', price: '15 000', currency: '₸/мес',
    features: ['25 ключей', '6 000 визитов/мес', '3 города', 'Трекинг конкурентов', 'Расширенные отчёты'],
    cta: 'Выбрать',
    highlight: true,
  },
  {
    name: 'Агентство', price: '25 000', currency: '₸/мес',
    features: ['50 ключей', '11 000 визитов/мес', 'Весь Казахстан', 'White-label отчёты', 'Персональный менеджер'],
    cta: 'Выбрать',
  },
];

const faqs = [
  { q: 'Безопасно ли это для сайта?', a: 'Мы используем плавный ramp-up, KZ residential прокси и уникальные fingerprints. Каждый визит выглядит как реальный казахстанский пользователь.' },
  { q: 'Как быстро виден результат?', a: 'Первые изменения позиций наблюдаются через 2–3 недели. Устойчивый рост в ТОП-10 по локальным запросам — 4–6 недель.' },
  { q: 'Для каких сайтов подходит?', a: 'Сайты услуг, e-commerce, информационные проекты на .kz с локальными запросами. Лучший эффект — по среднечастотным ключам.' },
  { q: 'Есть ли пробный период?', a: 'Да, 7 дней бесплатного использования без ввода карты.' },
  { q: 'Можно ли отслеживать позиции без накрутки?', a: 'Да, трекинг позиций доступен как отдельная функция для мониторинга вас и конкурентов.' },
];
</script>

<template>
  <div class="min-h-screen bg-white">
    <!-- Nav -->
    <header class="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span class="text-xl font-bold text-primary-600">RankPapa</span>
        <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#how" class="hover:text-gray-900">Как работает</a>
          <a href="#features" class="hover:text-gray-900">Преимущества</a>
          <a href="#pricing" class="hover:text-gray-900">Цены</a>
          <a href="#faq" class="hover:text-gray-900">FAQ</a>
        </nav>
        <div class="flex items-center gap-3">
          <RouterLink to="/login" class="text-sm font-medium text-gray-600 hover:text-gray-900">Войти</RouterLink>
          <RouterLink to="/register" class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
            Попробовать бесплатно
          </RouterLink>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="py-24 px-6 bg-gradient-to-b from-gray-50 to-white text-center">
      <div class="max-w-3xl mx-auto">
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-primary-50 text-primary-700 text-sm font-medium rounded-full mb-6">
          🇰🇿 Первый ПФ-сервис для Google Казахстана
        </div>
        <h1 class="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Выведите сайт в ТОП Google.kz за 4–6 недель
        </h1>
        <p class="text-xl text-gray-500 mb-10">
          Реальные казахстанские визиты из Google-поиска. Фиксированная цена, прозрачная статистика, 7 дней бесплатно.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <RouterLink to="/register" class="px-8 py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors text-lg">
            Начать бесплатно →
          </RouterLink>
          <a href="#how" class="px-8 py-4 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-lg">
            Как это работает
          </a>
        </div>
        <p class="mt-6 text-sm text-gray-400">Не нужна карта. 7 дней бесплатного теста.</p>
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="py-20 px-6">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-3xl font-bold text-center text-gray-900 mb-4">Как это работает</h2>
        <p class="text-center text-gray-500 mb-14">Запустить первую кампанию можно за 5 минут</p>
        <div class="grid md:grid-cols-4 gap-8">
          <div v-for="step in steps" :key="step.num" class="text-center">
            <div class="text-4xl font-black text-primary-100 mb-3">{{ step.num }}</div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ step.title }}</h3>
            <p class="text-sm text-gray-500">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Features -->
    <section id="features" class="py-20 px-6 bg-gray-50">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-3xl font-bold text-center text-gray-900 mb-4">Преимущества</h2>
        <p class="text-center text-gray-500 mb-14">Технологии, которые делают каждый визит неотличимым от реального</p>
        <div class="grid md:grid-cols-3 gap-6">
          <div v-for="f in features" :key="f.title" class="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div class="text-3xl mb-4">{{ f.icon }}</div>
            <h3 class="font-semibold text-gray-900 mb-2">{{ f.title }}</h3>
            <p class="text-sm text-gray-500">{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Pricing -->
    <section id="pricing" class="py-20 px-6">
      <div class="max-w-5xl mx-auto">
        <h2 class="text-3xl font-bold text-center text-gray-900 mb-4">Тарифы</h2>
        <p class="text-center text-gray-500 mb-14">Фиксированные цены без скрытых платежей. Первые 7 дней — бесплатно.</p>
        <div class="grid md:grid-cols-3 gap-6">
          <div
            v-for="plan in plans"
            :key="plan.name"
            class="rounded-2xl p-8 border"
            :class="plan.highlight ? 'border-primary-500 bg-primary-50 shadow-lg scale-105' : 'border-gray-200 bg-white'"
          >
            <div v-if="plan.highlight" class="inline-block px-3 py-1 bg-primary-600 text-white text-xs font-bold rounded-full mb-4">Популярный</div>
            <h3 class="text-xl font-bold text-gray-900 mb-1">{{ plan.name }}</h3>
            <div class="text-3xl font-extrabold text-gray-900 mb-6">
              {{ plan.price }} <span class="text-base font-normal text-gray-500">{{ plan.currency }}</span>
            </div>
            <ul class="space-y-3 mb-8">
              <li v-for="feature in plan.features" :key="feature" class="flex items-center gap-2 text-sm text-gray-600">
                <span class="text-primary-500">✓</span> {{ feature }}
              </li>
            </ul>
            <RouterLink
              to="/register"
              class="block w-full text-center py-3 rounded-xl font-medium transition-colors"
              :class="plan.highlight ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'"
            >
              {{ plan.cta }}
            </RouterLink>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="py-20 px-6 bg-gray-50">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-3xl font-bold text-center text-gray-900 mb-14">Частые вопросы</h2>
        <div class="space-y-4">
          <details v-for="faq in faqs" :key="faq.q" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <summary class="px-6 py-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-50">{{ faq.q }}</summary>
            <div class="px-6 pb-4 text-sm text-gray-600 leading-relaxed">{{ faq.a }}</div>
          </details>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="py-24 px-6 text-center bg-primary-600">
      <h2 class="text-3xl font-bold text-white mb-4">Готовы вырасти в Google.kz?</h2>
      <p class="text-primary-100 mb-8">7 дней бесплатно. Без карты. Без рисков.</p>
      <RouterLink to="/register" class="px-8 py-4 bg-white text-primary-700 font-bold rounded-xl hover:bg-primary-50 transition-colors text-lg">
        Начать бесплатный тест
      </RouterLink>
    </section>

    <!-- Footer -->
    <footer class="py-8 px-6 border-t border-gray-200 text-center text-sm text-gray-400">
      © 2026 RankPapa. Все права защищены.
    </footer>
  </div>
</template>
