// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Kiểm tra dịch vụ định danh: đọc thông tin công khai của realm communeos (không cần token).
// Gọi từ máy chủ Nuxt vì trình duyệt không gọi thẳng được Keycloak (CORS).
export default defineEventHandler(async (event) => {
  const { keycloakUrl } = useRuntimeConfig(event);
  const started = Date.now();
  try {
    const res = await $fetch<{ issuer: string }>(
      `${keycloakUrl}/realms/communeos/.well-known/openid-configuration`,
      { timeout: 5000 },
    );
    return { ok: true, ms: Date.now() - started, issuer: res.issuer };
  } catch {
    return { ok: false, ms: Date.now() - started };
  }
});
