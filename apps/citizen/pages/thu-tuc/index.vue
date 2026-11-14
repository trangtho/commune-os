<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search, RefreshCw, Sparkles, ListFilter, Settings2 } from 'lucide-vue-next'
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
function reset(){q.value='';category.value='';showRecommended=false}
</script>
<template>
<div class="space-y-4">
  <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-xl font-black">Danh mục thủ tục hành chính</h2><p class="text-sm text-muted">Tìm thủ tục phù hợp với nhu cầu của bạn, hoặc xem toàn bộ danh mục.</p></div>
    <span class="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-brand-700">{{list.length}} thủ tục mẫu</span></div>
  <div class="panel flex flex-wrap items-center gap-2 p-2"><Search class="ml-2 text-brand-600" :size="20"/><label for="procedure-search" class="sr-only">Tìm kiếm thủ tục hành chính</label>
    <input id="procedure-search" v-model="q" class="min-w-0 flex-[1_1_180px] bg-transparent p-2 text-sm outline-none" placeholder="Tìm kiếm thủ tục hành chính..."/>
    <label for="procedure-category" class="sr-only">Lĩnh vực thủ tục</label><select id="procedure-category" v-model="category" class="field !w-full sm:!w-auto"><option value="">Tất cả lĩnh vực</option><option v-for="c in categories" :key="c" :value="c">{{c}}</option></select>
    <button type="button" class="btn-outline w-full sm:w-auto" @click="reset">Đặt lại</button></div>
  <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Cách hiển thị danh mục">
    <button type="button" :aria-pressed="Boolean(ranked)" :disabled="!recommendations?.personalized||isFiltering" :class="['inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold',ranked?'border-brand-700 bg-brand-700 text-white':'border-slate-200 bg-white text-slate-600']" @click="showRecommended=true"><Sparkles :size="14"/>Gợi ý cho tôi</button>
    <button type="button" :aria-pressed="!ranked" :class="['inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold',!ranked?'border-brand-700 bg-brand-700 text-white':'border-slate-200 bg-white text-slate-600']" @click="showRecommended=false"><ListFilter :size="14"/>Tất cả thủ tục</button>
    <NuxtLink to="/ho-so-ca-nhan" class="ml-auto inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"><Settings2 :size="14"/>Tùy chọn cá nhân hóa</NuxtLink>
  </div>
  <div v-if="recommendations?.personalized&&!isFiltering" class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900" role="note">
    {{recommendations.reason}} <b>Gợi ý không đồng nghĩa với đủ điều kiện thực hiện thủ tục.</b>
  </div>
  <div v-else-if="!recommendations?.personalized" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-700">
    Đang hiển thị danh mục chung. <NuxtLink to="/ho-so-ca-nhan" class="font-bold text-brand-700 underline">Bật cá nhân hóa trong Hồ sơ cá nhân</NuxtLink> để nhận gợi ý có giải thích.
  </div>
  <div v-if="error" class="panel space-y-2 border border-rose-200 bg-rose-50 p-5 text-rose-800" role="alert"><p class="font-bold">Không tải được danh mục thủ tục.</p><p class="text-sm">Kiểm tra kết nối PostgreSQL và thử lại.</p><button class="btn-outline" @click="refresh()"><RefreshCw :size="16"/>Thử lại</button></div>
  <div v-else-if="recommendError&&showRecommended" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="status">Không tải được gợi ý cá nhân. Danh mục chung vẫn có thể sử dụng. <button class="font-bold underline" @click="refreshRecommendations()">Thử lại</button></div>
  <div v-if="!error&&!list.length" class="panel p-8 text-center text-sm text-muted">Không tìm thấy thủ tục phù hợp. Hãy chuyển sang “Tất cả thủ tục” hoặc bỏ bộ lọc.</div>
  <div v-else-if="!error" class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"><ProcedureCard v-for="p in list" :key="p.id" :procedure="p" :reasons="reasons(p.id)"/></div>
  <p class="text-xs text-muted">* Thời hạn, lệ phí và thông tin thủ tục hiện là dữ liệu minh họa; cần đối chiếu quy định chính thức trước khi nộp.</p>
</div>
</template>
