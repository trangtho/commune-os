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
      title: 'CommuneOS · Cổng dịch vụ công dân',
      meta: [
        { name: 'description', content: 'Kênh công dân CommuneOS - nộp và theo dõi hồ sơ hành chính số (bản mô phỏng)' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/images/logo-hoc-vien-ky-thuat-cong-nghe-an-ninh.png' }
      ]
    }
  },
  runtimeConfig: {
    sessionSecret: process.env.SESSION_SECRET || '',
    oidcIssuer: process.env.CITIZEN_OIDC_ISSUER || '',
    oidcAuthorizeUrl: process.env.CITIZEN_OIDC_AUTHORIZE_URL || '',
    oidcTokenUrl: process.env.CITIZEN_OIDC_TOKEN_URL || '',
    oidcJwksUrl: process.env.CITIZEN_OIDC_JWKS_URL || '',
    oidcClientId: process.env.CITIZEN_OIDC_CLIENT_ID || '',
    oidcClientSecret: process.env.CITIZEN_OIDC_CLIENT_SECRET || '',
    oidcRedirectUri: process.env.CITIZEN_OIDC_REDIRECT_URI || '',
    aiEndpoint: process.env.CITIZEN_AI_ENDPOINT || '',
    aiModel: process.env.CITIZEN_AI_MODEL || '',
    aiToken: process.env.CITIZEN_AI_TOKEN || '',
    ragEndpoint: process.env.CITIZEN_RAG_ENDPOINT || '',
    ragToken: process.env.CITIZEN_RAG_TOKEN || '',
    resultEndpoint: process.env.CITIZEN_RESULTS_ENDPOINT || '',
    resultToken: process.env.CITIZEN_RESULTS_TOKEN || '',
    supportEndpoint: process.env.CITIZEN_SUPPORT_ENDPOINT || '',
    staffBridgeToken: process.env.CITIZEN_STAFF_BRIDGE_TOKEN || '',
    supportToken: process.env.CITIZEN_SUPPORT_TOKEN || '',
    dbHost: process.env.PGHOST || '127.0.0.1',
    dbPort: process.env.PGPORT || '5432',
    dbName: process.env.PGDATABASE || 'communeos',
    dbUser: process.env.PGUSER || 'communeos_app',
    dbPassword: process.env.PGPASSWORD || '',
    storageDir: process.env.STORAGE_DIR || './data/uploads',
    public: { demoMode: process.env.DEMO_MODE !== 'false', systemName: 'CommuneOS' }
  }
})
