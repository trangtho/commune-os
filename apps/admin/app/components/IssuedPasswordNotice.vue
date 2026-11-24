<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
<script setup lang="ts">
import { Check, Copy, KeyRound, X } from "lucide-vue-next";
import type { IssuedPassword } from "~/types";

// Mật khẩu tạm chỉ hiện một lần: hệ thống không lưu lại, đóng là mất. Lãnh đạo phải đổi khi đăng nhập lần đầu.
const props = defineProps<{ issued: IssuedPassword; title?: string }>();
defineEmits<{ close: [] }>();

const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard.writeText(`${props.issued.username}\n${props.issued.temporaryPassword}`);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <div role="status" class="rounded-lg border border-amber-300 bg-amber-50 p-5">
    <div class="flex items-start justify-between gap-3">
      <h2 class="flex items-center gap-2 text-lg font-semibold text-amber-900">
        <KeyRound class="h-5 w-5" aria-hidden="true" />
        {{ title ?? "Mật khẩu tạm của lãnh đạo xã" }}
      </h2>
      <button type="button" class="rounded p-1 text-amber-800 hover:bg-amber-100" aria-label="Đóng" @click="$emit('close')">
        <X class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
      <dt class="text-amber-900">Tên đăng nhập</dt>
      <dd class="font-mono font-semibold">{{ issued.username }}</dd>
      <dt class="text-amber-900">Mật khẩu tạm</dt>
      <dd class="font-mono text-lg font-bold tracking-wider">{{ issued.temporaryPassword }}</dd>
    </dl>
    <p class="mt-3 text-sm text-amber-900">
      Mật khẩu chỉ hiện <b>một lần</b>. Gửi cho lãnh đạo xã qua kênh an toàn; khi đăng nhập Cổng cán bộ xã lần đầu,
      lãnh đạo phải đặt mật khẩu mới.
    </p>
    <button
      type="button"
      class="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-amber-400 bg-white px-4 text-sm font-semibold hover:bg-amber-100"
      @click="copy"
    >
      <component :is="copied ? Check : Copy" class="h-4 w-4" aria-hidden="true" />
      {{ copied ? "Đã chép" : "Chép tên đăng nhập và mật khẩu" }}
    </button>
  </div>
</template>
