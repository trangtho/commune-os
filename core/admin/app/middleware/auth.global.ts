// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Chưa đăng nhập (hoặc token hết hạn) → chuyển về trang đăng nhập.
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === "/dang-nhap") return;
  const { isLoggedIn, isSysAdmin } = useAuth();
  if (!isLoggedIn.value || !isSysAdmin.value) return navigateTo("/dang-nhap");
});