<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Archive,Clock3,RefreshCw,Send,ShieldAlert} from 'lucide-vue-next'
type Policy={id:string;resource_kind:string;title:string;description:string;retention_days:number|null;legal_reference:string;approved:boolean;automatic_action:string}
type Review={id:string;policy_id:string;title:string;resource_kind:string;resource_reference:string;state:string;found_at:string;decision_note:string|null}
type PrivacyRequest={id:string;request_type:string;details:string;state:string;created_at:string;resolution_note:string|null}
const {data,pending,error,refresh}=await useFetch<{policies:Policy[];reviews:Review[];requests:PrivacyRequest[]}>(
 '/api/citizen/retention',{key:'citizen-retention'})
const requestType=ref<'access'|'correct'|'restrict'|'erase'|'retention_review'>('retention_review')
const details=ref('');const busy=ref(false);const notice=ref('');const failure=ref('')
const {dateTime}=useFormat()
const typeLabels={access:'Yêu cầu được biết / truy cập',correct:'Yêu cầu đính chính',restrict:'Yêu cầu hạn chế xử lý',erase:'Yêu cầu xem xét xóa dữ liệu',retention_review:'Yêu cầu xem xét thời hạn lưu trữ'}
function requestLabel(kind:string){return typeLabels[kind as keyof typeof typeLabels]||kind}
const stateLabels:Record<string,string>={received:'Đã tiếp nhận',reviewing:'Đang xem xét',resolved:'Đã xử lý',declined:'Không chấp thuận',review_due:'Đến hạn xem xét',restricted:'Đang hạn chế',archived:'Đã lưu trữ',keep:'Tiếp tục lưu'}
async function submitRequest(){
 if(busy.value||details.value.trim().length<10)return
 busy.value=true;failure.value='';notice.value=''
 try{await $fetch('/api/citizen/retention/requests',{method:'POST',body:{requestType:requestType.value,details:details.value.trim()}});details.value='';notice.value='Đã tiếp nhận yêu cầu. Việc xóa, sửa hoặc hạn chế phải được đơn vị phụ trách xem xét và quyết định.';await refresh()}
 catch(e){failure.value=readableError(e)}finally{busy.value=false}
}
</script>
<template>
 <div class="space-y-4">
  <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-xl font-black">Vòng đời và lưu trữ dữ liệu</h2><p class="mt-1 text-sm text-muted">Chính sách thời hạn, các dữ liệu cần kiểm tra và yêu cầu của bạn.</p></div><button class="btn-outline" :disabled="pending" @click="refresh()"><RefreshCw :size="16"/> Làm mới</button></div>
  <div class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><ShieldAlert class="mt-0.5 shrink-0" :size="18"/><p>Hạn bảo quản hành chính phải được cơ quan có thẩm quyền phê duyệt. Hệ thống không tự động tiêu hủy giấy tờ hoặc hồ sơ khi chưa có căn cứ và quyết định hợp lệ. Tác vụ định kỳ chỉ phát hiện và đánh dấu để xem xét.</p></div>
  <p v-if="error" role="alert" class="panel p-4 text-rose-700">Không tải được thông tin vòng đời dữ liệu.</p><p v-else-if="pending" class="panel p-4 text-sm text-muted">Đang tải chính sách...</p>
  <section class="panel space-y-3 p-4"><h3 class="section-label"><Clock3 :size="19"/> Chính sách theo nhóm dữ liệu</h3><article v-for="p in data?.policies||[]" :key="p.id" class="rounded-xl border border-slate-200 p-3"><div class="flex flex-wrap items-center justify-between gap-2"><h4 class="text-sm font-extrabold">{{p.title}}</h4><span :class="p.approved?'text-xs font-bold text-emerald-700':'text-xs font-bold text-amber-800'">{{p.approved?'Đã cấu hình quy tắc vận hành':'Chờ phê duyệt thời hạn'}}</span></div><p class="mt-1 text-sm text-slate-700">{{p.description}}</p><p class="mt-2 text-xs text-muted">Thời hạn lưu trữ: {{p.retention_days?`${p.retention_days} ngày`:'Chưa xác lập'}} · {{p.legal_reference}}</p></article></section>
  <section class="panel space-y-3 p-4"><h3 class="section-label"><Archive :size="19"/> Mốc vòng đời cần xem xét</h3><p v-if="!data?.reviews.length" class="text-sm text-muted">Chưa có dữ liệu đến hạn được tác vụ rà soát đánh dấu.</p><div v-for="r in data?.reviews||[]" :key="r.id" class="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"><p class="font-extrabold">{{r.title}} · {{stateLabels[r.state]||r.state}}</p><p class="mt-1 break-all text-xs text-muted">Mục: {{r.resource_kind}} / {{r.resource_reference}}</p><p class="text-xs text-muted">{{dateTime(r.found_at)}}</p><p v-if="r.decision_note" class="mt-1 text-xs">{{r.decision_note}}</p></div></section>
  <form class="panel space-y-3 p-4" @submit.prevent="submitRequest"><h3 class="section-label"><Send :size="18"/> Gửi yêu cầu liên quan đến dữ liệu</h3><label class="field-label" for="privacy-request-kind">Loại yêu cầu</label><select id="privacy-request-kind" v-model="requestType" class="field"><option v-for="(title,key) in typeLabels" :key="key" :value="key">{{title}}</option></select><label class="field-label" for="privacy-request-details">Nội dung, loại dữ liệu và lý do</label><textarea id="privacy-request-details" v-model="details" class="field" rows="4" minlength="10" maxlength="2000" required placeholder="Nêu rõ dữ liệu hoặc hồ sơ cần xem xét (không nhập mật khẩu, mã OTP)..."/><p class="text-xs text-muted">Gửi yêu cầu không đồng nghĩa dữ liệu sẽ bị xóa ngay. Một số hồ sơ bắt buộc phải được giữ theo quy định áp dụng.</p><p v-if="failure" role="alert" class="text-sm text-rose-700">{{failure}}</p><p v-if="notice" role="status" class="text-sm text-emerald-700">{{notice}}</p><button class="btn-primary" :disabled="busy||details.trim().length<10" type="submit">{{busy?'Đang gửi...':'Gửi yêu cầu'}} <Send :size="15"/></button></form>
  <section class="panel space-y-3 p-4"><h3 class="font-extrabold">Yêu cầu đã gửi</h3><p v-if="!data?.requests.length" class="text-sm text-muted">Chưa có yêu cầu.</p><article v-for="r in data?.requests||[]" :key="r.id" class="border-b border-slate-100 py-2 text-sm"><p class="font-extrabold">{{requestLabel(r.request_type)}} · {{stateLabels[r.state]||r.state}}</p><p class="mt-1 whitespace-pre-wrap break-words text-slate-700">{{r.details}}</p><p v-if="r.resolution_note" class="text-xs text-brand-700">Phản hồi: {{r.resolution_note}}</p><p class="text-xs text-muted">{{dateTime(r.created_at)}}</p></article></section>
 </div>
</template>
