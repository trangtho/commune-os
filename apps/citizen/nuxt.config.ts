// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {fileURLToPath} from 'node:url'
export default defineNuxtConfig({
  compatibilityDate: '2025-05-01',
  devtools: { enabled: false },
  // pg uses its JavaScript driver; the optional pg-native binding must not be
  // bundled into Cloudflare Workers. Nitro aliases it to an explicit guard.
  nitro: {
    alias: {
      'pg-native': fileURLToPath(new URL('./server/shims/pg-native-unavailable.mjs', import.meta.url))
    }
  },
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
    // Đăng nhập công dân bằng Keycloak và gọi lõi qua cổng APISIX.
    keycloakUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
    gatewayUrl: process.env.GATEWAY_URL || 'http://localhost:9080',
    keycloakClientSecret: process.env.CITIZEN_KEYCLOAK_SECRET || '',
    oidcIssuer: process.env.CITIZEN_OIDC_ISSUER || '',
    oidcAuthorizeUrl: process.env.CITIZEN_OIDC_AUTHORIZE_URL || '',
    oidcTokenUrl: process.env.CITIZEN_OIDC_TOKEN_URL || '',
    oidcJwksUrl: process.env.CITIZEN_OIDC_JWKS_URL || '',
    oidcClientId: process.env.CITIZEN_OIDC_CLIENT_ID || '',
    oidcClientSecret: process.env.CITIZEN_OIDC_CLIENT_SECRET || '',
    oidcRedirectUri: process.env.CITIZEN_OIDC_REDIRECT_URI || '',
    resultEndpoint: process.env.CITIZEN_RESULTS_ENDPOINT || '',
    resultToken: process.env.CITIZEN_RESULTS_TOKEN || '',
    ocrEndpoint: process.env.CITIZEN_OCR_ENDPOINT || '',
    supportEndpoint: process.env.CITIZEN_SUPPORT_ENDPOINT || '',
    staffBridgeToken: process.env.CITIZEN_STAFF_BRIDGE_TOKEN || '',
    supportToken: process.env.CITIZEN_SUPPORT_TOKEN || '',
    dbHost: process.env.PGHOST || '127.0.0.1',
    dbPort: process.env.PGPORT || '5432',
    dbName: process.env.PGDATABASE || 'communeos',
    dbUser: process.env.PGUSER || 'communeos_app',
    dbPassword: process.env.PGPASSWORD || '',
    storageDir: process.env.STORAGE_DIR || './data/uploads',
    // Dịch vụ tệp của lõi (kho đối tượng). Để trống: lưu vào storageDir trên đĩa.
    filesUrl: process.env.FILES_URL || '',
    filesServiceToken: process.env.FILES_SERVICE_TOKEN || '',
    public: { demoMode: process.env.DEMO_MODE !== 'false', systemName: 'CommuneOS' }
  }
})
