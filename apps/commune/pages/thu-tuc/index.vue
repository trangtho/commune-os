<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ArrowLeft,Search,RefreshCw,FilePlus2 } from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
import { normalizeSearch } from '~/utils/search'
const route=useRoute();const {data:procedures,error,refresh}=await useFetch<Procedure[]>('/api/procedures', {key:'staff-procedures'})
const q=ref(String(route.query.q||''));const published=ref(String(route.query.published||''))
const list=computed(()=>procedures.value?.filter(p=>(!published.value||String(p.published)===published.value)&&normalizeSearch(`${p.title} ${p.summary} ${p.category}`).includes(normalizeSearch(q.value)))||[])
</script>
<template><div class="space-y-4"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-xl font-black">Danh mục thủ tục hành chính</h2><p class="text-sm text-muted">Quản lý danh mục và công bố thủ tục cho công dân.</p></div><NuxtLink to="/thu-tuc" class="btn-outline"><FilePlus2 :size="16"/> Thêm thủ tục mới</NuxtLink></div>
 <div class="panel flex flex-wrap items-center gap-2 p-2"><Search class="ml-2 text-brand-600" :size="20"/><input v-model="q" class="min-w-0 flex-[1_1_180px] bg-transparent p-2 text-sm outline-none" placeholder="Tìm kiếm thủ tục hành chính..."/><select v-model="published" class="field !w-full sm:!w-auto"><option value="">Tất cả</option><option value="true">Đã công bố</option><option value="false">Chưa công bố</option></select><button class="btn-outline w-full sm:w-auto" @click="refresh()">Làm mới</button></div>
 <div v-if="error" class="panel space-y-2 border border-rose-200 bg-rose-50 p-5 text-rose-800"><p class="font-bold">Không tải được thủ tục từ PostgreSQL.</p><button class="btn-outline" @click="refresh()"><RefreshCw :size="16"/>Thử lại</button></div><div v-else-if="!list.length" class="panel p-9 text-center text-muted">Không tìm thấy thủ tục phù hợp.</div><div v-else class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"><ProcedureCard v-for="p in list" :key="p.id" :procedure="p" admin/></div>
 <p class="text-xs text-muted">* Thời hạn, lệ phí và danh mục thủ tục trong bản này là dữ liệu minh họa, không phải thông tin pháp lý chính thức.</p></div></template>
