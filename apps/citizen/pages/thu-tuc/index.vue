<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search,SlidersHorizontal,Grid2X2,ArrowRight } from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
const route=useRoute();const {data:procedures,error}=await useFetch<Procedure[]>('/api/procedures', {key:'citizen-procedures'})
const q=ref(String(route.query.q||''));const category=ref(String(route.query.category||''))
watch(()=>route.query.category, v=>category.value=String(v||''))
const list=computed(()=>procedures.value?.filter(p=>(!category.value||p.category===category.value)&&(`${p.title} ${p.summary}`).toLowerCase().includes(q.value.toLowerCase()))||[])
const categories=computed(()=>[...new Set(procedures.value?.map(p=>p.category)||[])])
</script>
<template><div class="space-y-4"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-xl font-black">Danh mục thủ tục hành chính</h2><p class="text-sm text-muted">Tìm và thực hiện các thủ tục phù hợp.</p></div><span class="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-brand-700">{{list.length}} thủ tục mẫu</span></div>
 <div class="panel flex flex-wrap items-center gap-2 p-2"><Search class="ml-2 text-brand-600" :size="20"/><input v-model="q" class="min-w-0 flex-[1_1_180px] bg-transparent p-2 text-sm outline-none" placeholder="Tìm kiếm thủ tục hành chính..."/><select v-model="category" class="field !w-full sm:!w-auto"><option value="">Tất cả lĩnh vực</option><option v-for="c in categories" :key="c" :value="c">{{c}}</option></select><button class="btn-outline w-full sm:w-auto" @click="q='';category=''">Đặt lại</button></div>
 <div class="flex flex-wrap gap-2"><button v-for="c in ['',...categories]" :key="c" :class="['rounded-full border px-3 py-1.5 text-xs font-bold',category===c?'border-brand-600 bg-brand-600 text-white':'border-slate-200 bg-white text-slate-600']" @click="category=c">{{c||'Tất cả'}}</button></div>
 <div v-if="error" class="panel space-y-2 border border-rose-200 bg-rose-50 p-5 text-rose-800"><p class="font-bold">Không tải được thủ tục từ PostgreSQL.</p><p class="text-sm">Máy chủ chưa có bảng hoặc dữ liệu thủ tục, hoặc kết nối cơ sở dữ liệu bị lỗi. Trên Ubuntu, chạy <code class="rounded bg-white px-1 py-0.5">make repair-db</code>, sau đó tải lại trang.</p><a href="/api/health" target="_blank" rel="noopener noreferrer" class="inline-flex rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-rose-100">Kiểm tra trạng thái API / PostgreSQL</a></div><div v-else-if="!list.length" class="panel p-9 text-center text-muted">Không tìm thấy thủ tục phù hợp. Hãy thử bỏ bộ lọc hoặc kiểm tra dữ liệu mẫu đã được nạp.</div><div v-else class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"><ProcedureCard v-for="p in list" :key="p.id" :procedure="p"/></div>
 <p class="text-xs text-muted">* Thời hạn, lệ phí và danh mục thủ tục trong bản này là dữ liệu minh họa, không phải thông tin pháp lý chính thức.</p></div></template>
