// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineNuxtConfig({
  compatibilityDate: '2025-05-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: { cssPath: '~/assets/css/main.css' },
  app: {
    head: {
      htmlAttrs: { lang: 'vi' },
      title: 'CommuneOS · Bảng quản trị cán bộ',
      meta: [
        { name: 'description', content: 'Kênh quản trị CommuneOS - cán bộ duyệt, giải quyết hồ sơ hành chính số (bản mô phỏng)' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/images/logo-bo-cong-an.png' }
      ]
    }
  },
  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET || '',
    dbHost: process.env.PGHOST || '127.0.0.1',
    dbPort: process.env.PGPORT || '5432',
    dbName: process.env.PGDATABASE || 'communeos',
    dbUser: process.env.PGUSER || 'communeos_app',
    dbPassword: process.env.PGPASSWORD || '',
    public: { demoMode: process.env.DEMO_MODE !== 'false', systemName: 'CommuneOS' }
  }
})
