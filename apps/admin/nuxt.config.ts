// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Địa chỉ cổng APISIX và Keycloak (đổi bằng biến môi trường nếu chạy máy khác).
const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:9080";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@nuxtjs/tailwindcss"],
  // Bảng quản trị chạy hoàn toàn trên trình duyệt (không cần SEO), đơn giản hơn.
  ssr: false,
  runtimeConfig: {
    // Chỉ dùng phía máy chủ Nuxt (server/api/dang-nhap.post.ts).
    keycloakUrl: process.env.KEYCLOAK_URL || "http://localhost:8080",
    public: {
      // Địa chỉ trình duyệt mở được: màn hình cán bộ xã và trang quản trị Keycloak.
      communeUrl: "http://localhost:3002",
      keycloakPublicUrl: "http://localhost:8080",
    },
  },
  routeRules: {
    // Trình duyệt gọi /rest/... cùng địa chỉ với trang → không lỗi CORS.
    // Nuxt chuyển tiếp nguyên yêu cầu (kèm token) sang cổng APISIX.
    "/rest/**": { proxy: `${gatewayUrl}/rest/**` },
    // Trang Tình trạng hệ thống kiểm tra từng dịch vụ lõi qua cổng (cần token sys_admin).
    "/workflow/**": { proxy: `${gatewayUrl}/workflow/**` },
    "/files/**": { proxy: `${gatewayUrl}/files/**` },
    "/accounts/**": { proxy: `${gatewayUrl}/accounts/**` },
    "/ai/**": { proxy: `${gatewayUrl}/ai/**` },
  },
});