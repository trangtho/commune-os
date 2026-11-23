<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search, RefreshCw, Sparkles, ListFilter, X } from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
import { normalizeSearch } from '~/utils/search'
const route=useRoute()
const {data:procedures,error,refresh}=await useFetch<Procedure[]>('/api/procedures',{key:'citizen-procedures'})
type SuggestedProcedure=Procedure & {reasons:string[]}
const {data:recommendations,error:recommendError,refresh:refreshRecommendations}=await useFetch<{
  personalized:boolean; reason:string; items:SuggestedProcedure[]
}>('/api/procedures/recommended',{key:'citizen-procedure-recommendations'})
const q=ref(String(route.query.q||''))
const category=ref(String(route.query.category||''))
const showRecommended=ref(true)
watch(()=>route.query.category, value=>category.value=String(value||''))
watch(()=>route.query.q, value=>q.value=String(value||''))
const categories=computed(()=>[...new Set((procedures.value||[]).map(p=>p.category))])
const isFiltering=computed(()=>Boolean(q.value.trim()||category.value))
const ranked=computed(()=>recommendations.value?.personalized&&!isFiltering.value&&showRecommended.value)
const list=computed(()=>{
  const base=ranked.value?(recommendations.value?.items||[]):(procedures.value||[])
  return base.filter(p=>(!category.value||p.category===category.value)&&normalizeSearch(`${p.title} ${p.summary} ${p.category}`).includes(normalizeSearch(q.value)))
})
const reasons=(id:string)=>ranked.value?recommendations.value?.items.find(p=>p.id===id)?.reasons:undefined
function reset(){q.value='';category.value='';showRecommended.value=false}
</script>
<template>
<div class="citizen-subpage citizen-procedures-page space-y-5">
 <div class="panel citizen-filter-panel space-y-3 p-4 sm:p-5">
  <div class="relative"><Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" :size="20"/><label for="procedure-search" class="sr-only">Tìm kiếm thủ tục hành chính</label>
   <input id="procedure-search" v-model="q" class="field !h-12 !pl-10 !pr-10 !text-base" placeholder="Tìm theo tên thủ tục, ví dụ: khai sinh"/>
   <button v-if="isFiltering" type="button" class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Bỏ tìm kiếm và lọc" @click="reset"><X :size="18"/></button></div>
  <div class="flex flex-wrap gap-2" role="group" aria-label="Lọc theo lĩnh vực">
   <button type="button" :aria-pressed="!category" :class="['rounded-full border px-3 py-1.5 text-sm font-medium',!category?'border-brand-600 bg-brand-600 text-white':'border-slate-300 bg-white text-slate-700 hover:border-brand-400']" @click="category=''">Tất cả lĩnh vực</button>
   <button v-for="c in categories" :key="c" type="button" :aria-pressed="category===c" :class="['rounded-full border px-3 py-1.5 text-sm font-medium',category===c?'border-brand-600 bg-brand-600 text-white':'border-slate-300 bg-white text-slate-700 hover:border-brand-400']" @click="category=c">{{c}}</button>
  </div>
 </div>

 <div class="citizen-list-toolbar flex flex-wrap items-center gap-2 text-sm">
  <span class="font-medium text-slate-700">{{list.length}} thủ tục</span>
  <template v-if="recommendations?.personalized">
   <span class="text-slate-300" aria-hidden="true">·</span>
   <div class="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="Cách sắp xếp">
    <button type="button" :aria-pressed="Boolean(ranked)" :disabled="isFiltering" :class="['inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium disabled:opacity-50',ranked?'bg-brand-600 text-white':'text-slate-700']" @click="showRecommended=true"><Sparkles :size="14"/>Gợi ý cho tôi</button>
    <button type="button" :aria-pressed="!ranked" :class="['inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium',!ranked?'bg-brand-600 text-white':'text-slate-700']" @click="showRecommended=false"><ListFilter :size="14"/>Tất cả thủ tục</button>
   </div>
   <span v-if="ranked" class="text-slate-600">{{recommendations.reason}} Gợi ý không đồng nghĩa với đủ điều kiện.</span>
  </template>
  <NuxtLink v-else to="/ho-so-ca-nhan" class="ml-auto text-brand-700 hover:underline">Bật gợi ý thủ tục cho riêng bạn</NuxtLink>
 </div>

 <div v-if="error" class="panel space-y-2 border-rose-200 bg-rose-50 p-5 text-rose-800" role="alert"><p class="font-semibold">Không tải được danh mục thủ tục.</p><p class="text-sm">Kiểm tra kết nối máy chủ và thử lại.</p><button class="btn-outline" @click="refresh()"><RefreshCw :size="16"/>Thử lại</button></div>
 <div v-else-if="recommendError&&showRecommended&&recommendations?.personalized" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">Không tải được gợi ý cá nhân; danh mục chung vẫn dùng được. <button class="font-semibold underline" @click="refreshRecommendations()">Thử lại</button></div>
 <div v-if="!error&&!list.length" class="panel p-8 text-center text-slate-600">Không tìm thấy thủ tục phù hợp. <button type="button" class="font-semibold text-brand-700 underline" @click="reset">Xem tất cả thủ tục</button></div>
 <div v-else-if="!error" class="citizen-catalog-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3"><ProcedureCard v-for="p in list" :key="p.id" :procedure="p" :reasons="reasons(p.id)"/></div>

 <div class="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-4 text-sm">
  <NuxtLink to="/goi-y-thu-tuc" class="font-semibold text-brand-700 hover:underline">Chưa biết tên thủ tục? Trả lời 4 câu hỏi để được gợi ý</NuxtLink>
  <NuxtLink to="/lien-thong" class="font-semibold text-brand-700 hover:underline">Chuẩn bị nhiều thủ tục cùng lúc</NuxtLink>
 </div>
 <p class="text-xs text-slate-600">Thời hạn, lệ phí và thông tin thủ tục là dữ liệu minh họa; cần đối chiếu quy định chính thức trước khi nộp.</p>
</div>
</template>
