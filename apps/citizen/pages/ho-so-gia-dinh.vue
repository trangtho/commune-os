<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { UsersRound, ShieldCheck, ArrowRight, RefreshCw, LockKeyhole, FilePlus2 } from 'lucide-vue-next'
interface Member { id:string; represented_name:string; relationship:string; procedure_id:string; procedure_title:string;valid_until:string;verified_at:string;status:string }
interface FamilyCase { id:string;representation_id:string;procedure_title:string;applicant_name:string;status:string;submitted_at:string|null;updated_at:string;document_count:number }
const {data,error,pending,refresh}=await useFetch<{members:Member[];cases:FamilyCase[];notice:string}>('/api/family',{key:'citizen-family-cases'})
const {dateTime,date}=useFormat()
const filter=ref('all')
const cases=computed(()=>filter.value==='all'?data.value?.cases||[]:(data.value?.cases||[]).filter(c=>c.representation_id===filter.value))
const members=computed(()=>data.value?.members||[])
const relationLabels:Record<string,string>={parent:'Cha/mẹ',child:'Con',spouse:'Vợ/chồng',guardian:'Người được giám hộ',other:'Quan hệ khác'}
</script>
<template>
 <div class="space-y-4">
  <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-xl font-black text-brand-900">Hồ sơ gia đình</h2><p class="mt-1 text-sm text-muted">Theo dõi hồ sơ bạn đã nộp thay người thân theo quyền đại diện được xác minh.</p></div><NuxtLink to="/dai-dien" class="btn-primary"><UsersRound :size="16"/>Quản lý quyền đại diện</NuxtLink></div>
  <div class="panel flex items-start gap-3 border-l-4 border-l-brand-600 p-4 text-sm"><LockKeyhole class="mt-0.5 shrink-0 text-brand-700" :size="20"/><p>Không tự động liên kết toàn bộ hồ sơ của người thân. Chỉ hiển thị hồ sơ do chính tài khoản này thực hiện trong phạm vi đại diện đã xác minh và còn hiệu lực.</p></div>
  <section v-if="error" role="alert" class="panel p-4 text-rose-700">Không tải được dữ liệu gia đình. <button class="btn-outline mt-2" @click="refresh()">Thử lại</button></section>
  <template v-else>
   <section class="panel p-4 sm:p-5"><div class="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 class="section-label !mb-0"><ShieldCheck :size="19"/>Thành viên được đại diện</h3><button class="btn-outline !px-3 !py-1.5" :disabled="pending" @click="refresh()"><RefreshCw :size="15"/>Làm mới</button></div>
    <p v-if="pending&&!data" class="text-sm text-muted">Đang tải...</p><p v-else-if="!members.length" class="text-sm text-muted">Chưa có quyền đại diện được xác minh và còn hiệu lực. Bạn có thể gửi yêu cầu tại mục Đại diện người thân.</p>
    <div v-else class="grid gap-3 sm:grid-cols-2"><article v-for="m in members" :key="m.id" class="rounded-xl border border-slate-200 bg-slate-50 p-4"><p class="font-extrabold text-brand-900">{{m.represented_name}}</p><p class="mt-1 text-xs text-slate-600">{{relationLabels[m.relationship]||m.relationship}} · {{m.procedure_title}}</p><p class="mt-1 text-xs text-slate-600">Phạm vi: một thủ tục · Có hiệu lực đến {{date(m.valid_until)}}</p><span class="mt-2 inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">Đã xác minh</span></article></div>
   </section>
   <section class="panel p-4 sm:p-5"><h3 class="section-label">Hồ sơ thuộc phạm vi đại diện</h3><label for="family-member" class="field-label">Lọc theo người được đại diện</label><select id="family-member" v-model="filter" class="field mb-4"><option value="all">Tất cả thành viên đã được xác minh</option><option v-for="m in members" :key="m.id" :value="m.id">{{m.represented_name}} – {{m.procedure_title}}</option></select>
    <p v-if="!cases.length" class="rounded-lg bg-slate-50 p-4 text-sm text-muted">Chưa có hồ sơ do bạn nộp thay trong phạm vi này.</p>
    <div v-else class="grid gap-3"><article v-for="c in cases" :key="c.id" class="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div class="min-w-0"><p class="break-all text-xs font-bold text-brand-700">{{c.id}}</p><h4 class="mt-1 font-bold">{{c.procedure_title}}</h4><p class="text-sm text-slate-600">Người được đại diện: {{c.applicant_name}}</p><p class="mt-1 text-xs text-muted">Cập nhật {{dateTime(c.updated_at)}} · {{c.document_count}} tài liệu</p></div><div class="flex shrink-0 flex-wrap items-center gap-2"><StatusPill :status="c.status as any"/><NuxtLink :to="`/ho-so/${c.id}`" class="btn-outline !px-3 !py-2">Xem hồ sơ<ArrowRight :size="15"/></NuxtLink></div></article></div>
   </section>
  </template>
 </div>
</template>
