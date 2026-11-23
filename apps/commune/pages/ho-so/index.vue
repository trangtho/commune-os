<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { Search,FolderOpen,FilePlus2,ChevronRight,Filter,ClipboardList } from 'lucide-vue-next'
import type {Application,ApplicationStatus} from '~/types/models'
import { normalizeSearch } from '~/utils/search'
const {data:cases,error,refresh}=await useFetch<Application[]>('/api/applications', {key:'staff-applications'})
const {date, dateTime}=useFormat();const q=ref(String(useRoute().query.q||''));const status=ref(['draft','submitted','processing','supplement','completed','rejected','overdue'].includes(String(useRoute().query.status))?String(useRoute().query.status):'')
const isOverdue=(c:Application)=>Boolean(c.due_at&&new Date(c.due_at)<new Date()&&['submitted','processing','supplement'].includes(c.status))
const filtered=computed(()=>cases.value?.filter(c=>(!status.value||(status.value==='overdue'?isOverdue(c):c.status===status.value))&&normalizeSearch(`${c.id} ${c.procedure_title} ${c.applicant_name}`).includes(normalizeSearch(q.value)))||[])
const count=(s:ApplicationStatus)=>cases.value?.filter(c=>c.status===s).length||0
// Lọc nhanh theo trạng thái thay cho hàng ô số liệu; số đếm lấy từ toàn bộ hồ sơ.
const tabs=computed(()=>[{value:'',label:'Tất cả',n:cases.value?.length||0},{value:'submitted',label:'Mới tiếp nhận',n:count('submitted')},{value:'processing',label:'Đang xử lý',n:count('processing')},{value:'supplement',label:'Chờ bổ sung',n:count('supplement')},{value:'overdue',label:'Quá hạn',n:cases.value?.filter(isOverdue).length||0},{value:'completed',label:'Hoàn thành',n:count('completed')}])
</script>
<template><div class="space-y-4">
 <div class="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Lọc theo trạng thái"><button v-for="t in tabs" :key="t.value" type="button" :aria-pressed="status===t.value" :class="['inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition',status===t.value?'border-brand-700 bg-brand-700 text-white':'border-slate-200 bg-white text-slate-700 hover:border-brand-300']" @click="status=t.value">{{t.label}}<span :class="['rounded-full px-1.5 text-xs',status===t.value?'bg-white/20':'bg-slate-100 text-slate-600']">{{t.n}}</span></button></div>
 <div class="panel flex flex-wrap items-center gap-2 p-2"><Search :size="19" class="ml-2 text-brand-600"/><input v-model="q" class="min-w-0 flex-[1_1_170px] bg-transparent p-2 text-sm outline-none" placeholder="Tìm theo mã hồ sơ, tên thủ tục, người nộp..."/><button class="btn-outline w-full sm:w-auto" @click="refresh()">Làm mới</button></div>
 <div v-if="error" class="panel p-5 text-rose-700">Không tải được danh sách. Kiểm tra PostgreSQL và phiên đăng nhập.</div><div v-else-if="!filtered.length" class="panel p-8 text-center text-muted">Không có hồ sơ phù hợp.</div><template v-else>
  <div class="grid gap-3 lg:hidden">
   <article v-for="c in filtered" :key="c.id" class="panel space-y-3 p-4">
    <div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><p class="break-all text-sm font-extrabold text-brand-700">{{c.id}}</p><p class="mt-1 break-words text-sm font-semibold">{{c.procedure_title}}</p><p class="mt-1 text-xs text-muted">{{c.applicant_name}} · {{c.category}}</p></div><StatusPill :status="c.status"/></div>
    <div class="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs"><div><p class="text-muted">Ngày nộp</p><p class="font-semibold">{{c.status==='draft'?'Chưa nộp':dateTime(c.submitted_at)}}</p></div><div><p class="text-muted">Hạn xử lý</p><p class="font-semibold">{{c.status==='draft'?'Chưa tính':date(c.due_at)}}</p></div></div>
    <p v-if="c.due_at&&new Date(c.due_at)<new Date()&&['submitted','processing','supplement'].includes(c.status)" class="text-xs font-bold text-rose-600">Hồ sơ đã quá hạn xử lý</p>
    <NuxtLink :to="`/ho-so/${c.id}`" class="btn-outline w-full !text-xs">Xem và xử lý <ChevronRight :size="14"/></NuxtLink>
   </article>
  </div>
  <div class="panel scrollbar-hide hidden max-w-full overflow-x-auto lg:block"><table class="w-full min-w-[720px] text-left text-sm"><thead class="bg-[#edf4fd] text-xs font-bold text-slate-700"><tr><th class="px-4 py-3">Mã hồ sơ</th><th class="px-4 py-3">Thủ tục</th><th class="px-4 py-3">Người nộp</th><th class="px-4 py-3">Trạng thái</th><th class="px-4 py-3">Hạn xử lý</th><th class="px-4 py-3">Thao tác</th></tr></thead><tbody><tr v-for="c in filtered" :key="c.id" class="border-t border-slate-100 hover:bg-blue-50/60"><td class="px-4 py-3 font-bold text-brand-700">{{c.id}}</td><td class="px-4 py-3">{{c.procedure_title}}</td><td class="px-4 py-3">{{c.applicant_name}}</td><td class="px-4 py-3"><StatusPill :status="c.status"/><span v-if="c.due_at&&new Date(c.due_at)<new Date()&&['submitted','processing','supplement'].includes(c.status)" class="ml-1 text-xs font-bold text-rose-600">Quá hạn</span></td><td class="px-4 py-3 text-xs">{{c.status==='draft'?'Chưa tính':date(c.due_at)}}</td><td class="px-4 py-3"><NuxtLink :to="`/ho-so/${c.id}`" class="btn-outline !px-3 !py-1.5 !text-xs">Xem và xử lý <ChevronRight :size="14"/></NuxtLink></td></tr></tbody></table></div></template><p class="text-xs text-muted">Hiển thị {{filtered.length}} hồ sơ.</p></div></template>
