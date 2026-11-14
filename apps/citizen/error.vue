<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { AlertTriangle, RefreshCw, House } from 'lucide-vue-next'
const props = defineProps<{error: {statusCode?:number; statusMessage?:string; message?:string}}>()
const code = computed(() => Number(props.error?.statusCode || 500))
const title = computed(() => code.value === 404
  ? 'Không tìm thấy trang này'
  : code.value === 401 || code.value === 403
    ? 'Bạn không có quyền truy cập'
    : 'Không thể mở trang')
function backHome() { clearError({ redirect: '/' }) }
function retry() { clearError(); if (import.meta.client) window.location.reload() }
</script>
<template>
  <main class="flex h-[100dvh] min-h-0 items-center justify-center overflow-y-auto bg-[#f7faff] p-4">
    <section class="panel w-full max-w-lg space-y-4 p-7 text-center" role="alert">
      <span class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-700"><AlertTriangle :size="33" /></span>
      <p class="text-xs font-black tracking-widest text-brand-700">COMMUNEOS · {{ code }}</p>
      <h1 class="text-2xl font-extrabold">{{ title }}</h1>
      <p class="text-sm leading-relaxed text-muted">Trang không khả dụng hoặc kết nối dịch vụ đang gián đoạn. Dữ liệu đã lưu trên máy chủ sẽ không bị xóa do lỗi hiển thị.</p>
      <div class="flex flex-wrap justify-center gap-2">
        <button class="btn-outline" @click="backHome"><House :size="16" /> Trang chủ</button>
        <button class="btn-primary" @click="retry"><RefreshCw :size="16" /> Thử lại</button>
      </div>
    </section>
  </main>
</template>
