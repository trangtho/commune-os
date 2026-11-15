<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { LogIn, LockKeyhole, ShieldCheck, House } from "lucide-vue-next";
definePageMeta({ layout: "blank" });
const route = useRoute();
const username = ref("");
const password = ref("");
const loading = ref(false);
const errorText = ref("");
async function login() {
  loading.value = true;
  errorText.value = "";
  try {
    await $fetch("/api/auth/login", {
      method: "POST",
      body: { username: username.value, password: password.value },
    });
    await refreshNuxtData("staff-auth");
    const next = String(route.query.next || "/");
    await navigateTo(
      next.startsWith("/") && !next.startsWith("//") ? next : "/",
    );
  } catch (e) {
    errorText.value = readableError(e);
  } finally {
    loading.value = false;
  }
}
</script>
<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <div
      class="hero-gradient hero-pattern relative hidden items-center justify-center overflow-hidden p-12 text-white lg:flex"
    >
      <div class="absolute inset-y-0 right-0 w-full opacity-30">
        <img
          src="/images/ubnd-hero-clean.png"
          class="h-full w-full object-contain object-top"
          alt="Trụ sở UBND minh họa"
        />
      </div>
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
    <div class="flex items-center justify-center p-6">
      <form class="panel w-full max-w-md space-y-5 p-7" @submit.prevent="login">
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
          class="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800"
        >
          <b>Thông tin đăng nhập demo</b>
          <p>Tên đăng nhập: <code>canbo.xa-a / canbo.xa-b</code></p>
          <p>Mật khẩu: <code>12345</code></p>
          <p class="mt-1 text-xs">Không sử dụng dữ liệu cá nhân thật.</p>
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
          />
        </div>
        <p
          v-if="errorText"
          class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700"
        >
          {{ errorText }}
        </p>
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          <LogIn :size="17" />{{ loading ? "Đang xác thực..." : "Đăng nhập" }}
        </button>
      </form>
    </div>
  </div>
</template>
