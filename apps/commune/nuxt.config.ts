// SPDX-License-Identifier: Apache-2.0
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: { head: { title: 'CommuneOS · Xã Thành Phú', meta: [{ name:'viewport', content:'width=device-width, initial-scale=1' },
        { name:'description', content:'CommuneOS - Điều hành hành chính cấp xã, bản demo mô phỏng.' }] } },
  runtimeConfig: { public: {
    apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8080',
    demoMode: process.env.NUXT_PUBLIC_DEMO_MODE || 'true',
    oidcUrl: process.env.NUXT_PUBLIC_OIDC_URL || 'http://localhost:8081',
    oidcRealm: process.env.NUXT_PUBLIC_OIDC_REALM || 'communeos',
    oidcClient: process.env.NUXT_PUBLIC_OIDC_CLIENT || 'communeos-web'
  }},
  compatibilityDate: '2025-01-01'
})
