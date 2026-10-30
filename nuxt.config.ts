export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  css: [
    '~/assets/css/main.css'
  ],
  runtimeConfig: {
    studioKey: process.env.NUXT_STUDIO_KEY || 'studio'
  },
  app: {
    head: {
      htmlAttrs: { lang: 'vi' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ]
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  },
  routeRules: {
    '/images/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' }
    },
    '/admin/**': {
      headers: {
        'cache-control': 'no-store, max-age=0',
        'x-robots-tag': 'noindex, nofollow'
      }
    },
    '/api/admin/**': {
      headers: { 'cache-control': 'no-store' }
    }
  },
  nitro: {
    experimental: { tasks: true },
    scheduledTasks: {
      // 00:05 ngày 1 hàng tháng: đối soát và lập phiếu chi nháp khi đủ hạn mức.
      '5 0 1 * *': ['affiliate:monthly-reconcile']
    }
  },
  vite: {
    optimizeDeps: { include: ['vant'] }
  }
})
