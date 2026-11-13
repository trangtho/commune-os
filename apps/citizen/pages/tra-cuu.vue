<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search,ArrowRight } from 'lucide-vue-next'
import type {Application} from '~/types/models'
const {data:cases}=await useFetch<Application[]>('/api/applications', {key:'citizen-applications'})
const q=ref('');const submitted=ref(false)
const results=computed(()=>!submitted.value?[]:cases.value?.filter(c=>c.id.toLowerCase().includes(q.value.toLowerCase()))||[])
const {date}=useFormat()
</script>
<template><div class="space-y-4"><div><h2 class="text-xl font-black">Tra cứu tiến độ hồ sơ</h2><p class="text-sm text-muted">Chỉ hiển thị hồ sơ thuộc tài khoản Công dân đang đăng nhập.</p></div><form class="panel flex flex-wrap gap-3 p-4" @submit.prevent="submitted=true"><div class="flex min-w-0 flex-[1_1_250px] items-center gap-2"><Search :size="20" class="text-brand-600"/><input v-model="q" class="field" placeholder="Nhập mã hồ sơ (ví dụ HS-2026-...)" required/></div><button class="btn-primary w-full sm:w-auto" type="submit">Tra cứu <ArrowRight :size="16"/></button></form><div v-if="submitted&&!results.length" class="panel p-7 text-center text-sm text-muted">Không có hồ sơ nào khớp mã tra cứu trong tài khoản này.</div><NuxtLink v-for="c in results" :key="c.id" :to="`/ho-so/${c.id}`" class="panel flex flex-wrap items-center justify-between gap-3 p-5 hover:border-blue-300"><span><b class="block text-brand-700">{{c.id}}</b><small class="text-sm">{{c.procedure_title}} · Hạn {{date(c.due_at)}}</small></span><span class="flex items-center gap-2"><StatusPill :status="c.status"/><ArrowRight :size="17"/></span></NuxtLink></div></template>
