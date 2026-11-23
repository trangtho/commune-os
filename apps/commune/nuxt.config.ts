// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineNuxtConfig({
  compatibilityDate: '2025-05-01',
  devtools: { enabled: false },
  // Không dùng app manifest; tắt để tránh lỗi "#app-manifest" khi chạy dev.
  experimental: { appManifest: false },
  modules: ['@nuxtjs/tailwindcss'],
  // Phông Be Vietnam Pro (OFL-1.1) đóng gói cùng ứng dụng, không tải từ máy chủ ngoài lúc chạy.
  css: ['@fontsource/be-vietnam-pro/400.css', '@fontsource/be-vietnam-pro/500.css', '@fontsource/be-vietnam-pro/600.css', '@fontsource/be-vietnam-pro/700.css'],
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
        { rel: 'icon', type: 'image/svg+xml', href: '/images/logo-communeos.svg' }
      ]
    }
  },
  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET || '',
    // Đăng nhập qua Keycloak, đọc dữ liệu qua cổng APISIX (API lõi /rest).
    keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:9080',
    dbHost: process.env.PGHOST || '127.0.0.1',
    dbPort: process.env.PGPORT || '5432',
    dbName: process.env.PGDATABASE || 'communeos',
    dbUser: process.env.PGUSER || 'communeos_app',
    dbPassword: process.env.PGPASSWORD || '',
    public: { demoMode: process.env.DEMO_MODE !== 'false', systemName: 'CommuneOS' }
  }
})
