<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search,ArrowRight,FolderOpen,FilePlus2,Bot,AlertTriangle,Layers3 } from 'lucide-vue-next'
import type { Procedure,Application } from '~/types/models'
import { normalizeSearch } from '~/utils/search'
definePageMeta({title:'Trang chủ'})
const {data:procedures,error:procError,refresh:retryProcedures}=await useFetch<Procedure[]>('/api/procedures', {key:'citizen-procedures'})
const {data:recommendations}=await useFetch<{personalized:boolean;items:(Procedure&{reasons:string[]})[]}>('/api/procedures/recommended',{key:'citizen-procedure-recommendations'})
const {data:auth}=await useFetch<{authenticated:boolean;name?:string}>('/api/auth/me', {key:'citizen-auth-home'})
const {data:cases,error:casesError,refresh:refreshCases}=await useFetch<Application[]>('/api/applications', {
 key:'citizen-applications-home', immediate:Boolean(auth.value?.authenticated), default:()=>[]
})
const {date}=useFormat();const search=ref('')
const total=computed(()=>cases.value?.filter(c=>c.status!=='draft').length||0)
const active=computed(()=>cases.value?.filter(c=>['processing','submitted'].includes(c.status)).length||0)
const completed=computed(()=>cases.value?.filter(c=>c.status==='completed').length||0)
const supplement=computed(()=>cases.value?.filter(c=>c.status==='supplement').length||0)
const suggestions=computed(()=>(recommendations.value?.personalized?recommendations.value.items:(procedures.value||[])).filter(p=>normalizeSearch(`${p.title} ${p.summary} ${p.category}`).includes(normalizeSearch(search.value))).slice(0,6))
// Hồ sơ đang chờ người dân hoặc cơ quan xử lý, cần bổ sung lên đầu; tối đa 3 hồ sơ trên trang chủ.
const ongoing=computed(()=>(cases.value||[]).filter(c=>['supplement','submitted','processing'].includes(c.status)).sort((a,b)=>(a.status==='supplement'?0:1)-(b.status==='supplement'?0:1)).slice(0,3))
const quickTerms=['Khai sinh','Hộ kinh doanh','Cư trú','Chứng thực']
function searchFor(term:string){navigateTo('/thu-tuc?q='+encodeURIComponent(term))}
const suggestionReasons=(id:string)=>recommendations.value?.personalized?recommendations.value.items.find(p=>p.id===id)?.reasons:undefined
</script>
<template><div class="space-y-6">
 <section class="panel p-4 sm:p-6" aria-labelledby="home-search-title">
  <h2 id="home-search-title" class="text-lg font-semibold text-ink sm:text-xl">Xin chào{{auth?.authenticated?', '+auth.name:''}}. Bạn cần làm thủ tục gì?</h2>
  <form class="mt-3 flex flex-col gap-2 sm:flex-row" @submit.prevent="searchFor(search)">
   <label for="home-search" class="sr-only">Tìm thủ tục</label>
   <div class="relative flex-1"><Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" :size="20"/><input id="home-search" v-model="search" class="field !h-12 !pl-10 !text-base" placeholder="Ví dụ: khai sinh, đăng ký hộ kinh doanh, chứng thực..."/></div>
   <button class="btn-primary !h-12 !px-6" type="submit">Tìm thủ tục</button>
  </form>
  <div class="mt-3 flex flex-wrap items-center gap-2 text-sm"><span class="text-slate-600">Hay tìm:</span><button v-for="t in quickTerms" :key="t" type="button" class="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:border-brand-400 hover:text-brand-700" @click="searchFor(t)">{{t}}</button><NuxtLink to="/tim-theo-tinh-huong" class="ml-auto font-semibold text-brand-700 hover:underline">Chưa biết tên thủ tục? Tìm theo tình huống</NuxtLink></div>
 </section>

 <section class="grid gap-3 md:grid-cols-3" aria-label="Việc thường làm">
  <NuxtLink to="/thu-tuc" class="panel group flex items-start gap-3 p-4 hover:border-brand-300"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white"><FilePlus2 :size="22"/></span><span><b class="block font-semibold text-ink">Nộp hồ sơ mới</b><span class="text-sm text-slate-600">Chọn thủ tục, điền thông tin, tải giấy tờ</span></span></NuxtLink>
  <NuxtLink to="/ho-so" class="panel group flex items-start gap-3 p-4 hover:border-brand-300"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><FolderOpen :size="22"/></span><span><b class="block font-semibold text-ink">Theo dõi hồ sơ</b><span class="text-sm text-slate-600">{{auth?.authenticated?`${active} hồ sơ đang giải quyết`:'Xem tiến độ, nhận kết quả'}}</span></span></NuxtLink>
  <NuxtLink to="/tro-ly" class="panel group flex items-start gap-3 p-4 hover:border-brand-300"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white"><Bot :size="22"/></span><span><b class="block font-semibold text-ink">Hỏi trợ lý AI</b><span class="text-sm text-slate-600">Giấy tờ, lệ phí, thời hạn; có trích nguồn</span></span></NuxtLink>
 </section>

 <NuxtLink v-if="supplement" to="/ho-so?status=supplement" class="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 hover:bg-amber-100" role="status"><AlertTriangle :size="22" class="shrink-0"/><span class="flex-1"><b class="font-semibold">{{supplement}} hồ sơ cần bổ sung giấy tờ</b><span class="block text-sm">Bổ sung sớm để hồ sơ không bị chậm.</span></span><ArrowRight :size="18"/></NuxtLink>

 <section v-if="auth?.authenticated && ongoing.length" aria-labelledby="home-ongoing-title">
  <div class="mb-3 flex items-center justify-between gap-2"><h2 id="home-ongoing-title" class="text-lg font-semibold text-ink">Hồ sơ đang giải quyết</h2><NuxtLink to="/ho-so" class="text-sm font-semibold text-brand-700 hover:underline">Xem tất cả</NuxtLink></div>
  <p v-if="casesError" class="panel p-4 text-sm text-rose-700">Không tải được hồ sơ. <button class="font-semibold underline" @click="refreshCases()">Thử lại</button></p>
  <ul v-else class="panel divide-y divide-slate-100">
   <li v-for="c in ongoing" :key="c.id"><NuxtLink :to="`/ho-so/${c.id}`" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-brand-50/50"><span class="font-mono text-sm font-semibold text-brand-700">{{c.id}}</span><span class="min-w-0 flex-1 text-ink">{{c.procedure_title}}</span><span v-if="c.due_at" class="text-sm text-slate-600">Hạn {{date(c.due_at)}}</span><StatusPill :status="c.status"/></NuxtLink></li>
  </ul>
 </section>

 <section aria-labelledby="home-procedures-title">
  <div class="mb-3 flex items-center justify-between gap-2"><h2 id="home-procedures-title" class="text-lg font-semibold text-ink">{{recommendations?.personalized?'Thủ tục gợi ý cho bạn':'Thủ tục thường dùng'}}</h2><NuxtLink to="/thu-tuc" class="text-sm font-semibold text-brand-700 hover:underline">Xem tất cả thủ tục</NuxtLink></div>
  <div v-if="procError" class="panel p-5 text-sm text-rose-700">Không tải được thủ tục. Kiểm tra <a href="/api/health" target="_blank" rel="noopener noreferrer" class="font-semibold underline">/api/health</a> hoặc chạy <code>make repair-db</code> trên máy chủ. <button class="ml-1 font-semibold underline" @click="retryProcedures()">Thử lại</button>.</div>
  <div v-else-if="!suggestions.length" class="panel p-5 text-sm text-slate-600">Không tìm thấy thủ tục phù hợp với từ khóa đang nhập.</div>
  <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><ProcedureCard v-for="p in suggestions" :key="p.id" :procedure="p" :reasons="suggestionReasons(p.id)"/></div>
 </section>

 <NuxtLink to="/lien-thong" class="flex items-center gap-3 text-sm text-slate-700 hover:text-brand-700"><Layers3 :size="18"/>Cần làm nhiều thủ tục cùng lúc (ví dụ khi sinh con, chuyển nhà)? <span class="font-semibold text-brand-700">Chuẩn bị theo nhóm</span></NuxtLink>
</div></template>
