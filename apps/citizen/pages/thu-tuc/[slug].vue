<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ArrowLeft,ArrowRight,CheckCircle2,Clock3,Wallet,FileText,Info,Bot } from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
const route=useRoute()
const {data:p,error}=await useFetch<Procedure>(`/api/procedures/${route.params.slug}`, {key:`citizen-procedure:${String(route.params.slug)}`})
</script>
<template><div class="citizen-subpage citizen-procedure-detail-page space-y-5">
 <NuxtLink to="/thu-tuc" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft :size="16"/> Danh mục thủ tục</NuxtLink>
 <div v-if="error" class="panel p-6 text-rose-700">Không tìm thấy thủ tục.</div>
 <template v-else-if="p">
  <section class="panel p-5 sm:p-6">
   <p class="text-sm font-medium text-brand-700">{{p.category}}</p>
   <h2 class="mt-1 text-2xl font-bold text-ink">{{p.title}}</h2>
   <p class="mt-2 max-w-3xl text-slate-700">{{p.summary}}</p>
   <dl class="mt-5 grid gap-3 sm:grid-cols-3">
    <div class="rounded-xl bg-slate-50 p-4"><dt class="flex items-center gap-2 text-sm text-slate-600"><FileText :size="17"/>Giấy tờ cần có</dt><dd class="mt-1 text-lg font-semibold text-ink">{{p.documents?.length||0}} loại<span v-if="p.documents?.some(d=>d.is_required)" class="text-sm font-normal text-slate-600">, {{p.documents.filter(d=>d.is_required).length}} bắt buộc</span></dd></div>
    <div class="rounded-xl bg-slate-50 p-4"><dt class="flex items-center gap-2 text-sm text-slate-600"><Wallet :size="17"/>Lệ phí (mẫu)</dt><dd class="mt-1 text-lg font-semibold text-ink">{{p.fee_note}}</dd></div>
    <div class="rounded-xl bg-slate-50 p-4"><dt class="flex items-center gap-2 text-sm text-slate-600"><Clock3 :size="17"/>Thời hạn (mẫu)</dt><dd class="mt-1 text-lg font-semibold text-ink">{{p.sla_days}} ngày làm việc</dd></div>
   </dl>
   <p v-if="p.available_in_my_commune===false" class="mt-5 rounded-lg bg-amber-50 p-3 font-medium text-amber-900">Xã của bạn chưa mở thủ tục này trên cổng trực tuyến. Vui lòng liên hệ UBND xã.</p>
   <div v-else class="citizen-detail-actions mt-5 flex flex-wrap gap-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-5 max-sm:border-t max-sm:border-slate-200 max-sm:bg-white max-sm:p-3">
    <NuxtLink class="btn-primary !px-6 max-sm:flex-1" :to="`/nop-ho-so/${p.id}`">Nộp hồ sơ trực tuyến <ArrowRight :size="16"/></NuxtLink>
    <NuxtLink :to="`/tro-ly?procedure=${encodeURIComponent(p.id)}`" class="btn-outline max-sm:flex-1"><Bot :size="17"/> Hỏi trợ lý về thủ tục này</NuxtLink>
   </div>
  </section>
  <div class="grid gap-5 lg:grid-cols-2">
   <section class="panel p-5" aria-labelledby="proc-docs"><h3 id="proc-docs" class="mb-2 flex items-center gap-2 text-lg font-semibold text-ink"><FileText :size="20" class="text-brand-600"/>Giấy tờ cần chuẩn bị</h3>
    <ol class="divide-y divide-slate-100"><li v-for="doc in p.documents" :key="doc.document_code" class="flex items-start gap-2 py-3"><CheckCircle2 :size="18" class="mt-0.5 shrink-0 text-emerald-600"/><span class="flex-1 text-slate-800">{{doc.document_name}}</span><span :class="['shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',doc.is_required?'bg-rose-50 text-rose-700':'bg-slate-100 text-slate-600']">{{doc.is_required?'Bắt buộc':'Không bắt buộc'}}</span></li></ol></section>
   <section class="panel p-5" aria-labelledby="proc-howto"><h3 id="proc-howto" class="mb-2 flex items-center gap-2 text-lg font-semibold text-ink"><Info :size="20" class="text-brand-600"/>Cách thực hiện</h3><p class="leading-7 text-slate-700">{{p.instructions}}</p><p class="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Nội dung thủ tục và mức phí đang là dữ liệu mô phỏng. Đối chiếu văn bản pháp lý hiện hành trước khi vận hành thật.</p></section>
  </div>
  <ProcedureVersionHistory :procedure-id="String(route.params.slug)"/>
 </template>
</div></template>
