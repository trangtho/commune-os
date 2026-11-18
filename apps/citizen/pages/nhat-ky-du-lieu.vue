<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Activity,ShieldCheck,ShieldAlert,RefreshCw,Search} from 'lucide-vue-next'
type Event={id:number;action:string;purpose:string;processing_unit:string;resource_kind:string;
 resource_reference:string;actor_kind:'citizen'|'system'|'authorized_unit';occurred_at:string}
const {data,pending,error,refresh}=await useFetch<{items:Event[];integrity:{checked:number;ok:boolean};coverage:string}>(
 '/api/citizen/data-access',{key:'citizen-data-access'})
const {dateTime}=useFormat()
const query=ref('')
const filtered=computed(()=>data.value?.items.filter(e=>[e.purpose,e.action,e.processing_unit,e.resource_kind].join(' ').toLocaleLowerCase('vi').includes(query.value.toLocaleLowerCase('vi')))||[])
const actionLabels:Record<string,string>={view_profile:'Xem hồ sơ cá nhân',view_case:'Tra cứu hồ sơ',read_autofill:'Đọc dữ liệu gợi ý tự điền',download_vault_file:'Truy cập giấy tờ trong kho',download_case_attachment:'Tải tài liệu hồ sơ',share_vault_to_case:'Chia sẻ giấy tờ cho hồ sơ',consent_granted:'Cấp quyền chia sẻ',consent_withdrawn:'Rút quyền chia sẻ',privacy_request_created:'Gửi yêu cầu dữ liệu'}
</script>
<template>
 <div class="space-y-4">
  <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-xl font-black">Nhật ký sử dụng dữ liệu cá nhân</h2><p class="mt-1 text-sm text-muted">Kiểm tra hoạt động sử dụng dữ liệu thuộc phạm vi Cổng công dân đang tích hợp.</p></div><button type="button" class="btn-outline" :disabled="pending" @click="refresh()"><RefreshCw :size="16"/> Làm mới</button></div>
  <div class="panel space-y-2 p-4"><div class="flex items-center gap-2"><ShieldCheck v-if="data?.integrity.ok" :size="20" class="text-emerald-700"/><ShieldAlert v-else :size="20" class="text-amber-700"/><p class="font-extrabold text-sm">{{data?.integrity.ok?'Chuỗi nhật ký đã vượt qua kiểm tra toàn vẹn':'Chưa xác minh được toàn vẹn nhật ký'}}</p></div><p class="text-xs text-muted">Đã kiểm tra {{data?.integrity.checked||0}} sự kiện. Sử dụng hàm băm liên kết và cơ chế chỉ ghi thêm; không thay thế giám sát độc lập hoặc chống lại quản trị viên cơ sở dữ liệu có quyền cao.</p><p class="text-xs text-amber-800">{{data?.coverage||'Các hệ thống ngoài cổng công dân có thể chưa gửi nhật ký về đây.'}}</p></div>
  <div class="panel flex items-center gap-2 p-3"><Search :size="18" class="text-brand-700"/><label class="sr-only" for="audit-search">Tìm hoạt động</label><input id="audit-search" v-model="query" class="w-full bg-transparent text-sm outline-none" placeholder="Tìm theo mục đích, đơn vị xử lý, hoạt động..." maxlength="100"/></div>
  <p v-if="error" role="alert" class="panel p-4 text-rose-700">Không tải được nhật ký. <button class="font-bold underline" @click="refresh()">Thử lại</button></p>
  <p v-else-if="pending" role="status" class="panel p-4 text-sm text-muted">Đang tải nhật ký...</p>
  <p v-else-if="!filtered.length" class="panel p-5 text-sm text-muted">Chưa có sự kiện phù hợp. Nhật ký chỉ được ghi khi có hoạt động thuộc các điểm đã tích hợp.</p>
  <div v-for="e in filtered" :key="e.id" class="panel flex items-start gap-3 p-4"><span class="rounded-lg bg-blue-50 p-2 text-brand-700"><Activity :size="18"/></span><div class="min-w-0 space-y-1"><h3 class="text-sm font-extrabold">{{actionLabels[e.action]||e.action}}</h3><p class="break-words text-sm text-slate-700">Mục đích: {{e.purpose}}</p><p class="text-xs text-muted">Đơn vị xử lý: {{e.processing_unit}} · Chủ thể thao tác: {{e.actor_kind==='citizen'?'Công dân':e.actor_kind==='system'?'Hệ thống':'Đơn vị được phân quyền'}}</p><p v-if="e.resource_reference" class="break-all text-xs text-muted">Đối tượng: {{e.resource_kind}} · {{e.resource_reference}}</p><time class="text-xs font-semibold text-brand-700">{{dateTime(e.occurred_at)}}</time></div></div>
 </div>
</template>
