<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
// Trang tổng quan của cán bộ: 4 ô số liệu bấm được để lọc danh sách, và danh sách việc cần làm xếp theo hạn.
import { ArrowRight, Clock3, AlertCircle, FileInput, RefreshCw, TimerOff, ListChecks } from 'lucide-vue-next'
import type { StaffTask } from '~/types/staff'
import type { Application } from '~/types/models'
definePageMeta({title:'Tổng quan'})
const {data:cases,error:casesError,refresh:refreshCases,pending}=await useFetch<Application[]>('/api/applications', {key:'staff-applications'})
const {data:auth}=await useFetch<{authenticated:boolean;name?:string;role?:string}>('/api/auth/me', {key:'staff-auth-home'})
const {date}=useFormat()
// Việc lãnh đạo giao cho cán bộ đang đăng nhập (chưa xong), quá hạn lên đầu.
const {data:me}=await useFetch<{tasks:StaffTask[]}>('/api/me/overview',{key:'me-overview'})
const myTasks=computed(()=>(me.value?.tasks||[]).filter(t=>t.status!=='done').sort((a,b)=>Number(b.overdue)-Number(a.overdue)||(a.due_date?Date.parse(a.due_date):Infinity)-(b.due_date?Date.parse(b.due_date):Infinity)))
const open=['submitted','processing','supplement']
const isOverdue=(c:Application)=>Boolean(c.due_at&&new Date(c.due_at)<new Date()&&open.includes(c.status))
const count=(s:string)=>cases.value?.filter(c=>c.status===s).length||0
const tiles=computed(()=>[
 {label:'Mới tiếp nhận',value:count('submitted'),to:'/ho-so?status=submitted',icon:FileInput,tone:'bg-blue-50 text-blue-700'},
 {label:'Đang xử lý',value:count('processing'),to:'/ho-so?status=processing',icon:Clock3,tone:'bg-amber-50 text-amber-700'},
 {label:'Chờ công dân bổ sung',value:count('supplement'),to:'/ho-so?status=supplement',icon:AlertCircle,tone:'bg-violet-50 text-violet-700'},
 {label:'Quá hạn',value:cases.value?.filter(isOverdue).length||0,to:'/ho-so?status=overdue',icon:TimerOff,tone:'bg-rose-50 text-rose-700'},
])
// Việc cần làm: hồ sơ còn mở, quá hạn lên đầu, sau đó theo hạn gần nhất.
const todo=computed(()=>(cases.value||[]).filter(c=>open.includes(c.status)).sort((a,b)=>Number(isOverdue(b))-Number(isOverdue(a))||(a.due_at?Date.parse(a.due_at):Infinity)-(b.due_at?Date.parse(b.due_at):Infinity)).slice(0,10))
</script>
<template><div class="space-y-5">
 <p class="text-sm text-slate-600">Xin chào{{auth?.authenticated?', '+auth.name:''}}. Bấm vào một ô để xem đúng nhóm hồ sơ.</p>
 <div class="grid grid-cols-2 gap-3 lg:grid-cols-4"><NuxtLink v-for="t in tiles" :key="t.label" :to="t.to" class="stat-tile flex items-center gap-3 transition hover:border-brand-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-300"><span :class="['grid h-11 w-11 shrink-0 place-items-center rounded-xl',t.tone]"><component :is="t.icon" :size="22"/></span><span class="min-w-0"><span class="block text-2xl font-bold text-ink">{{t.value}}</span><span class="block text-sm font-medium text-slate-600">{{t.label}}</span></span></NuxtLink></div>
 <section v-if="myTasks.length" class="panel overflow-hidden">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h2 class="flex items-center gap-2 text-lg font-bold text-ink"><ListChecks :size="19" class="text-brand-700"/>Việc lãnh đạo giao cho bạn ({{myTasks.length}})</h2><NuxtLink to="/viec-duoc-giao" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Cập nhật tiến độ <ArrowRight :size="15"/></NuxtLink></div>
  <ul class="divide-y divide-slate-100"><li v-for="t in myTasks.slice(0,5)" :key="t.id"><NuxtLink to="/viec-duoc-giao" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-brand-50/60 sm:flex-nowrap"><span class="min-w-0 basis-full sm:flex-1 sm:basis-auto"><span class="block truncate font-semibold text-ink">{{t.title}}</span><span class="block text-sm text-slate-600">Giao bởi {{t.created_by_name}}<span v-if="t.dossier_id"> · hồ sơ {{t.dossier_id}}</span></span></span><span :class="['shrink-0 text-sm sm:w-36 sm:text-right',t.overdue?'font-bold text-rose-700':'text-slate-600']">{{t.overdue?'Quá hạn ':t.due_date?'Hạn ':'Không đặt hạn'}}{{t.due_date?date(t.due_date):''}}</span><ArrowRight :size="16" class="hidden shrink-0 text-slate-400 sm:block"/></NuxtLink></li></ul>
 </section>
 <section class="panel overflow-hidden">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h2 class="text-lg font-bold text-ink">Hồ sơ cần xử lý</h2><div class="flex items-center gap-3"><button class="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-brand-700" :disabled="pending" @click="refreshCases()"><RefreshCw :size="15" :class="pending?'animate-spin':''"/>Làm mới</button><NuxtLink to="/ho-so" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">Tất cả hồ sơ <ArrowRight :size="15"/></NuxtLink></div></div>
  <div v-if="casesError" class="p-5 text-sm text-rose-700">Không tải được danh sách hồ sơ. <button class="font-bold underline" @click="refreshCases()">Thử lại</button></div>
  <p v-else-if="!todo.length" class="p-8 text-center text-slate-600">Không có hồ sơ nào đang chờ xử lý.</p>
  <ul v-else class="divide-y divide-slate-100">
   <li v-for="c in todo" :key="c.id"><NuxtLink :to="`/ho-so/${c.id}`" class="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition hover:bg-brand-50/60 sm:flex-nowrap">
    <span class="min-w-0 basis-full sm:flex-1 sm:basis-auto"><span class="block truncate font-semibold text-ink">{{c.procedure_title}}</span><span class="block text-sm text-slate-600">{{c.id}} · {{c.applicant_name}}</span></span>
    <StatusPill :status="c.status"/>
    <span :class="['shrink-0 text-sm sm:w-36 sm:text-right',isOverdue(c)?'font-bold text-rose-700':'text-slate-600']">{{isOverdue(c)?'Quá hạn ':'Hạn '}}{{date(c.due_at)}}</span>
    <ArrowRight :size="16" class="hidden shrink-0 text-slate-400 sm:block"/>
   </NuxtLink></li>
  </ul>
 </section>
</div></template>
