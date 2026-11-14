<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ArrowRightLeft, Copy, RefreshCw, ShieldCheck, XCircle, Clock3 } from 'lucide-vue-next'
interface Draft {id:string;procedure_title:string;applicant_name:string;status:string;updated_at:string}
interface DraftList {items:Draft[];total:number;page:number;pageSize:number}
interface Handoff {handoffId:string;expiresAt:string;createdAt:string;revokedAt:string|null;redeemedAt:string|null;redeemedBy:string|null}
interface Issued {handoffId:string;code:string;expiresAt:string;applicationId:string;notice:string}
const route=useRoute()
const {data:auth}=await useFetch<{authenticated:boolean}>('/api/auth/me',{key:'handoff-auth'})
const page=ref(1)
const {data:drafts,error:draftError,refresh:refreshDrafts}=await useFetch<DraftList>('/api/applications',{
  key:'handoff-draft-cases',query:computed(()=>({paged:'1',status:'draft',page:page.value})),immediate:!!auth.value?.authenticated
})
const selected=ref(typeof route.query.case==='string'?route.query.case:'')
watch(()=>drafts.value?.items,items=>{if(!selected.value&&items?.length)selected.value=items[0].id},{immediate:true})
const {data:history,error:historyError,refresh:refreshHistory}=await useFetch<Handoff[]>(
  ()=>`/api/applications/${encodeURIComponent(selected.value||'none')}/handoff`,{key:'handoff-history',immediate:!!auth.value?.authenticated,watch:[selected]})
const issued=ref<Issued|null>(null),busy=ref(false),failure=ref(''),notice=ref('')
const {dateTime}=useFormat()
watch(selected,()=>{issued.value=null;failure.value='';notice.value=''})
function state(item:Handoff){return item.revokedAt?'Đã thu hồi':item.redeemedAt?'Cán bộ đã nhận':new Date(item.expiresAt).getTime()<=Date.now()?'Hết hạn':'Chưa sử dụng'}
async function issue(){if(!selected.value||busy.value)return;busy.value=true;failure.value='';notice.value=''
 try{issued.value=await $fetch<Issued>(`/api/applications/${encodeURIComponent(selected.value)}/handoff`,{method:'POST'});notice.value='Đã tạo mã mới. Chỉ cung cấp mã tại quầy cho cán bộ có thẩm quyền.';await refreshHistory()}
 catch(e){failure.value=readableError(e)}finally{busy.value=false}}
async function revoke(item:Handoff){if(!confirm('Thu hồi mã này?'))return;busy.value=true;failure.value=''
 try{await $fetch(`/api/applications/${encodeURIComponent(selected.value)}/handoff/${item.handoffId}`,{method:'DELETE'});if(issued.value?.handoffId===item.handoffId)issued.value=null;await refreshHistory()}
 catch(e){failure.value=readableError(e)}finally{busy.value=false}}
async function copyCode(){if(!issued.value)return;try{await navigator.clipboard.writeText(issued.value.code);notice.value='Đã sao chép mã.'}catch{notice.value='Không thể sao chép tự động. Hãy chọn mã để sao chép.'}}
</script>
<template>
 <div class="space-y-4">
  <div><h2 class="flex items-center gap-2 text-xl font-black text-brand-900"><ArrowRightLeft :size="22"/>Chuyển tiếp hồ sơ đến quầy</h2><p class="mt-1 text-sm text-muted">Chuẩn bị hồ sơ trực tuyến, nhận mã để cán bộ tiếp tục đối chiếu giấy tờ tại bộ phận một cửa.</p></div>
  <div class="rounded-xl border-l-4 border-l-blue-600 bg-blue-50 p-4 text-sm leading-6 text-blue-950" role="note"><ShieldCheck :size="18" class="mr-1 inline"/> Mã chỉ có hiệu lực 15 phút và dùng một lần. Cán bộ phải đăng nhập hệ thống nghiệp vụ để nhận dữ liệu; mã không thay thế việc xác minh danh tính hoặc xác nhận tiếp nhận chính thức.</div>
  <section v-if="!auth?.authenticated" class="panel space-y-3 p-5"><p class="text-sm">Bạn cần đăng nhập để chuyển tiếp hồ sơ nháp thuộc tài khoản của mình.</p><NuxtLink class="btn-primary" to="/dang-nhap">Đăng nhập</NuxtLink></section>
  <template v-else>
   <section class="panel space-y-4 p-4 sm:p-5">
    <h3 class="section-label">1. Chọn hồ sơ đã chuẩn bị</h3>
    <div v-if="draftError" role="alert" class="text-sm text-rose-700">Không tải được hồ sơ nháp. <button class="underline" @click="refreshDrafts()">Thử lại</button></div>
    <p v-else-if="!drafts?.total" class="text-sm text-muted">Chưa có hồ sơ nháp. Hãy chọn thủ tục và lưu bản nháp trước khi đến quầy.</p>
    <div v-else class="space-y-2"><label for="handoff-case" class="field-label">Hồ sơ nháp cần chuyển tiếp</label>
     <select id="handoff-case" v-model="selected" class="field"><option value="" disabled>Chọn hồ sơ</option><option v-for="d in drafts?.items||[]" :key="d.id" :value="d.id">{{d.id}} — {{d.procedure_title}} — {{d.applicant_name}}</option><option v-if="selected&&!drafts?.items.some(i=>i.id===selected)" :value="selected">{{selected}} (đã chọn từ trang hồ sơ)</option></select>
     <div v-if="(drafts?.total||0)>(drafts?.pageSize||10)" class="flex items-center gap-3 text-sm"><button type="button" class="btn-outline !py-1" :disabled="page<=1" @click="page--">Trang trước</button><span>Trang {{page}} / {{Math.ceil((drafts?.total||0)/(drafts?.pageSize||10))}}</span><button type="button" class="btn-outline !py-1" :disabled="page>=Math.ceil((drafts?.total||0)/(drafts?.pageSize||10))" @click="page++">Trang sau</button></div>
    </div>
    <p v-if="failure" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{{failure}}</p>
    <p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-800">{{notice}}</p>
    <button class="btn-primary" type="button" :disabled="!selected||busy" @click="issue"><ArrowRightLeft :size="17"/>{{busy?'Đang xử lý...':'Tạo mã chuyển tiếp'}}</button>
   </section>
   <section v-if="issued" class="panel space-y-3 p-4 sm:p-5" aria-live="polite"><h3 class="section-label">2. Xuất trình mã tại quầy</h3>
    <label for="handoff-issued" class="field-label">Mã chuyển tiếp của bạn (chỉ hiển thị lần này)</label>
    <div class="flex flex-wrap gap-2"><input id="handoff-issued" class="field min-w-0 flex-1 font-mono font-bold tracking-wide" :value="issued.code" readonly @focus="($event.target as HTMLInputElement).select()"/><button class="btn-outline" type="button" @click="copyCode"><Copy :size="16"/>Sao chép</button></div>
    <p class="flex gap-2 text-sm text-muted"><Clock3 :size="17"/>Hết hạn: {{dateTime(issued.expiresAt)}}. Khi tải lại trang, mã sẽ không được hiển thị lại; hãy tạo mã mới nếu cần.</p>
    <NuxtLink :to="`/ho-so/${issued.applicationId}`" class="text-sm font-semibold text-brand-700 underline">Mở hồ sơ liên quan</NuxtLink>
   </section>
   <section v-if="selected" class="panel space-y-3 p-4 sm:p-5"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="section-label !mb-0">Lịch sử chuyển tiếp</h3><button class="btn-outline !py-1.5" type="button" @click="refreshHistory()"><RefreshCw :size="15"/>Làm mới</button></div>
    <p v-if="historyError" role="alert" class="text-sm text-rose-700">Không tải được lịch sử mã chuyển tiếp.</p>
    <p v-else-if="!history?.length" class="text-sm text-muted">Hồ sơ chưa tạo mã chuyển tiếp.</p>
    <div v-for="h in history||[]" :key="h.handoffId" class="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 p-3"><div class="min-w-0"><p class="font-semibold text-brand-900">{{state(h)}}</p><p class="text-xs text-muted">Tạo lúc {{dateTime(h.createdAt)}} · Hết hạn {{dateTime(h.expiresAt)}}</p><p v-if="h.redeemedAt" class="text-xs text-muted">Cán bộ nhận lúc {{dateTime(h.redeemedAt)}}</p></div><button v-if="!h.revokedAt&&!h.redeemedAt&&new Date(h.expiresAt).getTime()>Date.now()" type="button" class="btn-outline !py-1.5 !text-rose-700" :disabled="busy" @click="revoke(h)"><XCircle :size="15"/>Thu hồi</button></div>
   </section>
  </template>
 </div>
</template>
