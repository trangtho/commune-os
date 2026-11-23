<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
definePageMeta({ layout: false });

const { login } = useAuth();
const username = ref("");
const password = ref("");
// Mã xác thực 6 số từ ứng dụng (FreeOTP, Google Authenticator) khi tài khoản đã bật xác thực hai lớp.
const otp = ref("");
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
  error.value = null;
  loading.value = true;
  error.value = await login(username.value.trim(), password.value, otp.value.trim());
  loading.value = false;
  if (!error.value) await navigateTo("/");
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center p-4">
    <form
      class="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6"
      @submit.prevent="submit"
    >
      <p class="text-lg font-bold">CommuneOS</p>
      <h1 class="mt-1 text-slate-600">Đăng nhập quản trị hệ thống</h1>

      <label for="username" class="mt-5 block text-sm font-medium"
        >Tên đăng nhập</label
      >
      <input
        id="username"
        v-model="username"
        autocomplete="username"
        class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3"
        required
      />

      <label for="password" class="mt-4 block text-sm font-medium"
        >Mật khẩu</label
      >
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3"
        required
      />

      <label for="otp" class="mt-4 block text-sm font-medium">Mã xác thực</label>
      <input
        id="otp"
        v-model="otp"
        inputmode="numeric"
        autocomplete="one-time-code"
        pattern="[0-9]{6}"
        maxlength="6"
        aria-describedby="otp-hint"
        class="mt-1 h-11 w-full rounded-md border border-slate-300 px-3 tracking-widest"
      />
      <p id="otp-hint" class="mt-1 text-xs text-slate-500">
        6 số trong ứng dụng xác thực. Bỏ trống nếu tài khoản chưa bật xác thực hai lớp.
      </p>

      <p
        v-if="error"
        role="alert"
        class="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
      >
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="loading"
        class="mt-5 h-11 w-full rounded-md bg-brand-700 font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {{ loading ? "Đang đăng nhập..." : "Đăng nhập" }}
      </button>
    </form>
  </main>
</template>
