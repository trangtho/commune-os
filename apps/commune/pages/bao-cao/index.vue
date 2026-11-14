<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { BarChart3,ClipboardList,Clock3,CheckCircle2,AlertCircle,FileText } from 'lucide-vue-next'
import type {Application,ApplicationStatus} from '~/types/models'
const {data:cases}=await useFetch<Application[]>('/api/applications', {key:'staff-reports'})
const {date}=useFormat()
const byStatus=computed(()=>{const r:Record<string,number>={};for(const c of cases.value||[])r[c.status]=(r[c.status]||0)+1;return r})
const byCategory=computed(()=>{const r:Record<string,number>={};for(const c of cases.value||[])r[c.category]=(r[c.category]||0)+1;return r})
const statusEntries=computed(()=>Object.entries(byStatus))
const categoryEntries=computed(()=>Object.entries(byCategory))
const overdue=cases.value?.filter(c=>c.due_at&&new Date(c.due_at)<new Date()&&['submitted','processing','supplement'].includes(c.status)).length||0
</script>
<template><div class="space-y-4"><div><h2 class="text-xl font-black">Báo cáo thống kê</h2><p class="text-sm text-muted">Tổng quan tình trạng xử lý hồ sơ hành chính (dữ liệu mô phỏng).</p></div>
 <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><MetricCard label="Tổng hồ sơ" :value="cases?.length||0" icon="files"/><MetricCard label="Đang xử lý" :value="byStatus.processing||0" icon="clock" tone="orange"/><MetricCard label="Cần bổ sung" :value="byStatus.supplement||0" icon="alert" tone="purple"/><MetricCard label="Quá hạn" :value="overdue" icon="alert" tone="red"/></div>
 <div class="grid gap-3 lg:grid-cols-2"><section class="panel p-5"><h3 class="section-label"><ClipboardList :size="21" class="text-brand-600"/>Theo trạng thái</h3><div class="space-y-2"><div v-for="[k,v] of statusEntries" :key="k" class="flex items-center justify-between p-3 rounded-lg border border-[#dae7f7] bg-white"><span class="text-sm font-semibold">{{k==='draft'?'Bản nháp':k==='submitted'?'Đã tiếp nhận':k==='processing'?'Đang xử lý':k==='supplement'?'Cần bổ sung':k==='completed'?'Hoàn thành':'Từ chối'}}</span><span class="text-xl font-extrabold text-brand-700">{{v}}</span></div></div></section>
 <section class="panel p-5"><h3 class="section-label"><FileText :size="21" class="text-brand-600"/>Theo lĩnh vực</h3><div class="space-y-2"><div v-for="[k,v] of categoryEntries" :key="k" class="flex items-center justify-between p-3 rounded-lg border border-[#dae7f7] bg-white"><span class="text-sm font-semibold truncate">{{k}}</span><span class="text-xl font-extrabold text-brand-700">{{v}}</span></div></div></section></div>
 <div class="panel p-5"><h3 class="section-label"><AlertCircle :size="21" class="text-rose-600"/>Cảnh báo quá hạn</h3><p class="text-sm text-muted">Có <b class="text-rose-700">{{overdue}}</b> hồ sơ đã vượt quá hạn xử lý dự kiến và cần xử lý ưu tiên.</p><NuxtLink to="/ho-so?status=submitted" class="btn-outline mt-3">Xem hồ sơ đang chờ xử lý <ArrowRight :size="14" class="inline"/></NuxtLink></div></div></template>
