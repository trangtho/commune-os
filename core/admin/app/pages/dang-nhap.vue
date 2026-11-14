<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
definePageMeta({ layout: false });

const { login } = useAuth();
const username = ref("");
const password = ref("");
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
  error.value = null;
  loading.value = true;
  error.value = await login(username.value.trim(), password.value);
  loading.value = false;
  if (!error.value) await navigateTo("/xa");
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 p-4">
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
        class="mt-5 h-11 w-full rounded-md bg-blue-700 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {{ loading ? "Đang đăng nhập..." : "Đăng nhập" }}
      </button>
    </form>
  </main>
</template>
