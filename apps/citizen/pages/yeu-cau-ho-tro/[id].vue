<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ArrowLeft, MessageCircle, RefreshCw, Send } from 'lucide-vue-next'
interface TicketEvent {id:number;actorType:'citizen'|'staff'|'system';actorName:string;eventType:'message'|'status';message:string;status:string|null;createdAt:string}
interface TicketDetail {id:string;category:string;subject:string;status:string;assignedStaff:string|null;resolution:string|null;applicationId:string|null;createdAt:string;updatedAt:string;events:TicketEvent[]}
const id=String(useRoute().params.id)
const {data:ticket,error,refresh}=await useFetch<TicketDetail>(`/api/tickets/${encodeURIComponent(id)}`,{key:`citizen-ticket:${id}`})
const labels:Record<string,string>={received:'Đã ghi nhận',processing:'Đang xử lý',waiting_citizen:'Cần bổ sung thông tin',answered:'Đã phản hồi',resolved:'Đã giải quyết',closed:'Đã đóng',reopened:'Đề nghị xử lý lại'}
const {dateTime}=useFormat()
const message=ref(''),busy=ref(false),notice=ref(''),failure=ref('')
async function reply(){if(busy.value||message.value.trim().length<5)return;busy.value=true;notice.value='';failure.value=''
 try{await $fetch(`/api/tickets/${encodeURIComponent(id)}/reply`,{method:'POST',body:{message:message.value}});message.value='';notice.value='Đã ghi nhận nội dung mới và cập nhật trạng thái khi cần.';await refresh()}
 catch(e){failure.value=readableError(e)}finally{busy.value=false}}
</script>
<template>
 <div class="space-y-4">
  <NuxtLink to="/yeu-cau-ho-tro" class="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft :size="16"/>Trung tâm hỗ trợ</NuxtLink>
  <div v-if="error" class="panel p-5 text-sm text-rose-700" role="alert">Không tìm thấy yêu cầu hoặc không có quyền truy cập. <button class="underline" @click="refresh()">Thử lại</button></div>
  <template v-else-if="ticket">
   <section class="panel space-y-3 p-4 sm:p-5"><div class="flex flex-wrap items-start justify-between gap-2"><div class="min-w-0"><p class="text-xs font-semibold text-muted">Mã yêu cầu YC-{{ticket.id.slice(0,8).toUpperCase()}}</p><h2 class="mt-1 break-words text-xl font-black text-brand-900">{{ticket.subject}}</h2></div><span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand-800">{{labels[ticket.status]||ticket.status}}</span></div>
    <div class="grid gap-3 border-t pt-3 text-sm sm:grid-cols-2"><p><span class="text-muted">Cập nhật:</span> {{dateTime(ticket.updatedAt)}}</p><p><span class="text-muted">Người phụ trách:</span> {{ticket.assignedStaff||'Chưa được phân công'}}</p></div><NuxtLink v-if="ticket.applicationId" :to="`/ho-so/${ticket.applicationId}`" class="text-sm font-bold text-brand-700 underline">Xem hồ sơ {{ticket.applicationId}}</NuxtLink>
    <p v-if="ticket.resolution" class="rounded-lg bg-green-50 p-3 text-sm text-green-900"><b>Kết quả xử lý:</b> {{ticket.resolution}}</p>
   </section>
   <section class="panel space-y-3 p-4 sm:p-5"><div class="flex items-center justify-between"><h3 class="section-label !mb-0"><MessageCircle :size="19"/>Lịch sử trao đổi</h3><button class="btn-outline !py-1.5" @click="refresh()"><RefreshCw :size="15"/>Làm mới</button></div>
    <div v-for="e in ticket.events" :key="e.id" :class="['rounded-xl border p-3',e.actorType==='staff'?'border-blue-200 bg-blue-50':e.actorType==='citizen'?'bg-white':'bg-slate-50']"><div class="flex flex-wrap items-center justify-between gap-1"><b class="text-sm">{{e.actorType==='staff'?'Cán bộ: ':e.actorType==='citizen'?'Công dân: ':'Hệ thống: '}}{{e.actorName}}</b><small class="text-muted">{{dateTime(e.createdAt)}}</small></div><p class="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{{e.message}}</p><p v-if="e.status" class="mt-1 text-xs font-semibold text-brand-700">{{labels[e.status]||e.status}}</p></div>
    <p v-if="ticket.events.length>=200" class="text-xs text-muted">Đang hiển thị 200 hoạt động đầu tiên. Liên hệ cán bộ nếu cần trích xuất đầy đủ lịch sử.</p>
   </section>
   <form class="panel space-y-3 p-4 sm:p-5" @submit.prevent="reply"><h3 class="section-label">Phản hồi hoặc đề nghị xử lý lại</h3><p class="text-sm text-muted">Nếu vấn đề chưa được giải quyết, hãy mô tả thêm. Yêu cầu đã đóng sẽ được chuyển lại trạng thái cần xử lý khi bạn phản hồi.</p><label class="field-label" for="ticket-reply">Nội dung bổ sung *</label><textarea id="ticket-reply" v-model="message" class="field" rows="4" minlength="5" maxlength="3000" required placeholder="Nội dung cần cán bộ xem lại..."/>
    <p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-800">{{notice}}</p><p v-if="failure" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{{failure}}</p><button class="btn-primary" type="submit" :disabled="busy||message.trim().length<5"><Send :size="17"/>{{busy?'Đang gửi...':'Gửi phản hồi'}}</button>
   </form>
  </template>
 </div>
</template>
