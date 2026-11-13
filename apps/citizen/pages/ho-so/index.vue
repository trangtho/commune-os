<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search,FolderOpen,FilePlus2,ChevronRight,Filter } from 'lucide-vue-next'
import type {Application,ApplicationStatus} from '~/types/models'
const {data:cases,error,refresh}=await useFetch<Application[]>('/api/applications', {key:'citizen-applications'})
const {date, dateTime}=useFormat();const q=ref('');const status=ref('')
const filtered=computed(()=>cases.value?.filter(c=>(!status.value||c.status===status.value)&&`${c.id} ${c.procedure_title}`.toLowerCase().includes(q.value.toLowerCase()))||[])
const count=(s:ApplicationStatus)=>cases.value?.filter(c=>c.status===s).length||0
</script>
<template><div class="space-y-4"><div class="flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-xl font-black">Hồ sơ của tôi</h2><p class="text-sm text-muted">Quản lý và theo dõi hồ sơ đã nộp.</p></div><NuxtLink to="/thu-tuc" class="btn-primary"><FilePlus2 :size="16"/> Nộp hồ sơ mới</NuxtLink></div>
 <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><MetricCard label="Tổng hồ sơ" :value="cases?.length||0" icon="files"/><MetricCard label="Đang xử lý" :value="count('processing')+count('submitted')" icon="clock"/><MetricCard label="Cần bổ sung" :value="count('supplement')" tone="orange" icon="alert"/><MetricCard label="Hoàn thành" :value="count('completed')" tone="green" icon="check"/></div>
 <div class="panel flex flex-wrap items-center gap-2 p-2"><Search :size="19" class="ml-2 text-brand-600"/><input v-model="q" class="min-w-0 flex-[1_1_170px] bg-transparent p-2 text-sm outline-none" placeholder="Tìm theo mã hồ sơ, tên thủ tục..."/><select v-model="status" class="field !w-full sm:!w-auto"><option value="">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="submitted">Đã tiếp nhận</option><option value="processing">Đang xử lý</option><option value="supplement">Cần bổ sung</option><option value="completed">Hoàn thành</option></select><button class="btn-outline w-full sm:w-auto" @click="refresh()">Làm mới</button></div>
 <div v-if="error" class="panel p-5 text-rose-700">Không tải được danh sách. Kiểm tra PostgreSQL và phiên đăng nhập.</div><div v-else-if="!filtered.length" class="panel p-8 text-center text-muted">Chưa có hồ sơ phù hợp.</div><template v-else>
  <!-- Phone/tablet: accessible cards avoid a table wider than the viewport. -->
  <div class="grid gap-3 lg:hidden">
   <article v-for="c in filtered" :key="c.id" class="panel space-y-3 p-4">
    <div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><p class="break-all text-sm font-extrabold text-brand-700">{{c.id}}</p><p class="mt-1 break-words text-sm font-semibold">{{c.procedure_title}}</p></div><StatusPill :status="c.status"/></div>
    <div class="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs"><div><p class="text-muted">Ngày nộp</p><p class="font-semibold">{{dateTime(c.submitted_at)}}</p></div><div><p class="text-muted">Hạn xử lý</p><p class="font-semibold">{{date(c.due_at)}}</p></div></div>
    <p v-if="c.due_at&&new Date(c.due_at)<new Date()&&c.status!=='completed'" class="text-xs font-bold text-rose-600">Hồ sơ đã quá hạn xử lý</p>
    <NuxtLink :to="c.status==='draft'?`/nop-ho-so/${c.procedure_id}?draft=${c.id}&step=2`:`/ho-so/${c.id}`" class="btn-outline w-full !text-xs">{{c.status==='draft'?'Tiếp tục nộp':'Xem chi tiết'}} <ChevronRight :size="14"/></NuxtLink>
   </article>
  </div>
  <!-- Desktop: preserve the data table used in the approved visual mockup. -->
  <div class="panel scrollbar-hide hidden max-w-full overflow-x-auto lg:block"><table class="w-full min-w-[720px] text-left text-sm"><thead class="bg-[#edf4fd] text-xs font-bold text-slate-700"><tr><th class="px-4 py-3">Mã hồ sơ</th><th class="px-4 py-3">Thủ tục</th><th class="px-4 py-3">Ngày nộp</th><th class="px-4 py-3">Trạng thái</th><th class="px-4 py-3">Hạn xử lý</th><th class="px-4 py-3">Thao tác</th></tr></thead><tbody><tr v-for="c in filtered" :key="c.id" class="border-t border-slate-100 hover:bg-blue-50/60"><td class="px-4 py-3 font-bold text-brand-700">{{c.id}}</td><td class="px-4 py-3">{{c.procedure_title}}</td><td class="px-4 py-3 text-xs text-muted">{{dateTime(c.submitted_at)}}</td><td class="px-4 py-3"><StatusPill :status="c.status"/><span v-if="c.due_at&&new Date(c.due_at)<new Date()&&c.status!=='completed'" class="ml-1 text-xs font-bold text-rose-600">Quá hạn</span></td><td class="px-4 py-3 text-xs">{{date(c.due_at)}}</td><td class="px-4 py-3"><NuxtLink :to="c.status==='draft'?`/nop-ho-so/${c.procedure_id}?draft=${c.id}&step=2`:`/ho-so/${c.id}`" class="btn-outline !px-3 !py-1.5 !text-xs">{{c.status==='draft'?'Tiếp tục nộp':'Xem chi tiết'}} <ChevronRight :size="14"/></NuxtLink></td></tr></tbody></table></div></template><p class="text-xs text-muted">Hiển thị {{filtered.length}} hồ sơ thuộc tài khoản đăng nhập.</p></div></template>
