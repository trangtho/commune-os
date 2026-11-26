<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { LogIn, LockKeyhole, ShieldCheck, House } from "lucide-vue-next";
definePageMeta({ layout: "blank" });
const route = useRoute();
const demoMode = useRuntimeConfig().public.demoMode;
const username = ref("");
const password = ref("");
const loading = ref(false);
const errorText = ref("");
// Lần đầu đăng nhập bằng mật khẩu tạm: hiện thêm ô đặt mật khẩu mới ngay tại đây.
const mustChange = ref(false);
const newPassword = ref("");
const confirmPassword = ref("");
const infoText = ref("");
async function changeFirstPassword() {
  if (newPassword.value !== confirmPassword.value) {
    errorText.value = "Hai lần nhập mật khẩu mới không khớp.";
    return;
  }
  await $fetch("/api/auth/first-password", {
    method: "POST",
    body: { username: username.value, currentPassword: password.value, newPassword: newPassword.value },
  });
  password.value = newPassword.value;
  newPassword.value = "";
  confirmPassword.value = "";
  mustChange.value = false;
  infoText.value = "Đã đặt mật khẩu mới. Đang đăng nhập...";
}
async function login() {
  loading.value = true;
  errorText.value = "";
  try {
    if (mustChange.value) {
      await changeFirstPassword();
      if (mustChange.value || errorText.value) return;
    }
    await $fetch("/api/auth/login", {
      method: "POST",
      body: { username: username.value, password: password.value },
    });
    await refreshNuxtData("staff-auth");
    const next = String(route.query.next || "/");
    await navigateTo(
      next.startsWith("/") && !next.startsWith("//") ? next : "/",
    );
  } catch (e: any) {
    if (e?.data?.data?.code === "password_change_required") {
      mustChange.value = true;
      infoText.value = "Đây là mật khẩu tạm. Hãy đặt mật khẩu mới (ít nhất 8 ký tự, có cả chữ và số).";
    } else {
      errorText.value = readableError(e);
    }
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="grid min-h-[100dvh] lg:grid-cols-2">
    <div
      class="hero-gradient relative hidden items-center justify-center overflow-hidden p-12 text-white lg:flex"
    >
      <div class="relative z-10 max-w-lg">
        <span
          class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/40 bg-white/20"
          ><ShieldCheck :size="45"
        /></span>
        <h1 class="text-5xl font-black">CommuneOS</h1>
        <p class="mt-4 text-xl font-bold">Bảng quản trị cán bộ quản lý</p>
        <p class="mt-5 text-sm leading-7 text-blue-50">
          Duyệt hồ sơ · Giải quyết đơn · Quản lý thủ tục · Theo dõi tiến độ xử
          lý.
        </p>
      </div>
    </div>
    <div class="flex min-w-0 items-center justify-center p-3 sm:p-6">
      <form class="panel w-full max-w-md space-y-4 p-4 sm:space-y-5 sm:p-7" @submit.prevent="login">
        <div class="mb-6 text-center">
          <span
            class="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-700"
            ><LockKeyhole :size="29"
          /></span>
          <h2 class="text-2xl font-black">Đăng nhập Cán bộ</h2>
          <p class="mt-1 text-sm text-muted">
            Môi trường trình diễn với tài khoản mẫu
          </p>
        </div>
        <div
          v-if="demoMode"
          class="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800"
        >
          <b>Tài khoản demo (sau khi chạy <code>make demo</code>)</b>
          <p>Cán bộ xử lý: <code>canbo.xa-a / canbo.xa-b</code></p>
          <p>Lãnh đạo xã: <code>lanhdao.xa-a / lanhdao.xa-b</code></p>
          <p>Mật khẩu: <code>Demo@2026!</code></p>
          <p class="mt-1 text-xs">Không sử dụng dữ liệu cá nhân thật. Tài khoản thật do quản trị hệ thống và lãnh đạo xã cấp.</p>
        </div>
        <div>
          <label class="field-label">Tên đăng nhập</label
          ><input
            v-model="username"
            class="field"
            required
            autocomplete="username"
          />
        </div>
        <div>
          <label class="field-label">Mật khẩu</label
          ><input
            v-model="password"
            class="field"
            type="password"
            required
            autocomplete="current-password"
            :readonly="mustChange"
          />
        </div>
        <template v-if="mustChange">
          <div>
            <label class="field-label" for="new-password">Mật khẩu mới</label
            ><input
              id="new-password"
              v-model="newPassword"
              class="field"
              type="password"
              required
              minlength="8"
              maxlength="64"
              autocomplete="new-password"
            />
          </div>
          <div>
            <label class="field-label" for="confirm-password">Nhập lại mật khẩu mới</label
            ><input
              id="confirm-password"
              v-model="confirmPassword"
              class="field"
              type="password"
              required
              minlength="8"
              maxlength="64"
              autocomplete="new-password"
            />
          </div>
        </template>
        <p
          v-if="infoText && !errorText"
          role="status"
          class="rounded-lg bg-brand-50 p-3 text-sm text-brand-800"
        >
          {{ infoText }}
        </p>
        <p
          v-if="errorText"
          class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {{ errorText }}
        </p>
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          <LogIn :size="17" />{{ loading ? "Đang xác thực..." : mustChange ? "Đặt mật khẩu mới và đăng nhập" : "Đăng nhập" }}
        </button>
      </form>
    </div>
  </div>
</template>
