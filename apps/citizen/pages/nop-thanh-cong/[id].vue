<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">import { CheckCircle2,ArrowRight,FolderOpen } from 'lucide-vue-next'
const id=String(useRoute().params.id)
</script>
<template><div class="panel mx-auto max-w-2xl space-y-5 px-5 py-12 text-center"><CheckCircle2 class="mx-auto text-green-500" :size="70"/><h2 class="text-3xl font-black text-green-800">Đã nộp hồ sơ thành công!</h2><p class="text-sm text-muted">Hồ sơ của bạn đã được ghi vào PostgreSQL và tạo thông báo xác nhận (dữ liệu mô phỏng).</p><div class="rounded-xl bg-blue-50 p-5"><small class="text-muted">Mã hồ sơ</small><p class="mt-1 text-2xl font-black text-brand-800">{{id}}</p></div><div class="flex flex-wrap justify-center gap-3"><NuxtLink :to="`/ho-so/${id}`" class="btn-primary"><FolderOpen :size="17"/>Xem hồ sơ</NuxtLink><NuxtLink to="/thu-tuc" class="btn-outline">Nộp hồ sơ khác <ArrowRight :size="16"/></NuxtLink></div></div></template>
