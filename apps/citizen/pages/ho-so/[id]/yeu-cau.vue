<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ArrowLeft,AlertTriangle,Clock3,FilePenLine,RotateCcw,Send,ShieldCheck} from 'lucide-vue-next'
import type {Application} from '~/types/models'
const id=String(useRoute().params.id)
const {date,dateTime}=useFormat()
const {data:caseData,error:caseError}=await useFetch<Application>(`/api/applications/${encodeURIComponent(id)}`)
interface Deadline {dueAt:string|null;daysLeft:number|null;level:'none'|'approaching'|'overdue';explanation:{reason:string;stage_name:string;unit_name:string;created_at:string}|null;notice:string}
interface CaseRequest {id:string;request_kind:string;reason:string;status:string;staff_response:string;decided_at:string;created_at:string}
const {data:deadline,error:deadlineError,refresh:refreshDeadline}=await useFetch<Deadline>(`/api/applications/${encodeURIComponent(id)}/deadline`)
const {data:requests,refresh:refreshRequests}=await useFetch<{items:CaseRequest[]}>(`/api/applications/${encodeURIComponent(id)}/requests`)
const kind=ref<'deadline_review'|'amendment'|'withdrawal'>('deadline_review')
const reason=ref('')
const withdrawConfirmed=ref(false)
const loading=ref(false)
const message=ref('')
const errorText=ref('')
const canRequest=computed(()=>Boolean(caseData.value&&['submitted','processing','supplement'].includes(caseData.value.status)))
const options=[
 {value:'deadline_review',title:'Yêu cầu xem xét chậm hạn',description:'Đề nghị cơ quan kiểm tra tiến độ và phản hồi lý do, thời điểm dự kiến.'},
 {value:'amendment',title:'Đề nghị chỉnh sửa hồ sơ',description:'Giải thích thông tin cần sửa; hồ sơ đã tiếp nhận không bị chỉnh sửa trực tiếp.'},
 {value:'withdrawal',title:'Đề nghị rút hồ sơ',description:'Chỉ cơ quan có thẩm quyền mới quyết định chấp thuận rút hồ sơ.'}
] as const
async function submitRequest(){
 if(loading.value||!canRequest.value||reason.value.trim().length<10)return
 if(kind.value==='withdrawal'&&!withdrawConfirmed.value)return
 loading.value=true;message.value='';errorText.value=''
 try{
  await $fetch(`/api/applications/${encodeURIComponent(id)}/requests`,{method:'POST',body:{kind:kind.value,reason:reason.value.trim()}})
  reason.value='';withdrawConfirmed.value=false
  message.value='Đã ghi nhận đề nghị. Hồ sơ chính thức chưa thay đổi và đang chờ cơ quan xem xét.'
  await refreshRequests()
 }catch(e){errorText.value=readableError(e)}finally{loading.value=false}
}
async function reapply(){
 if(loading.value||!caseData.value||!['rejected','completed','withdrawn'].includes(caseData.value.status))return
 loading.value=true;errorText.value=''
 try{
  const data=await $fetch<{id:string;procedureId:string}>(`/api/applications/${encodeURIComponent(id)}/reapply`,{method:'POST',body:{confirmed:true}})
  await navigateTo(`/nop-ho-so/${encodeURIComponent(data.procedureId)}?draft=${encodeURIComponent(data.id)}&step=1`)
 }catch(e){errorText.value=readableError(e)}finally{loading.value=false}
}
</script>
<template>
 <div class="space-y-4">
  <NuxtLink :to="`/ho-so/${encodeURIComponent(id)}`" class="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft :size="16"/>Về chi tiết hồ sơ</NuxtLink>
  <div><h2 class="text-xl font-black">Theo dõi thời hạn và đề nghị xử lý</h2><p class="text-sm text-muted">Mã hồ sơ: {{id}} · Mọi yêu cầu đều lưu lịch sử và cần cán bộ phản hồi.</p></div>
  <section v-if="caseError" class="panel p-5 text-rose-700" role="alert">Không thể truy cập hồ sơ. Kiểm tra phiên đăng nhập và quyền truy cập.</section>
  <template v-else-if="caseData">
   <section class="panel space-y-3 p-5" aria-labelledby="deadline-heading">
    <h3 id="deadline-heading" class="section-label"><Clock3 :size="18"/>Theo dõi thời hạn</h3>
    <p class="text-sm">Hạn xử lý: <b>{{date(deadline?.dueAt||caseData.due_at)}}</b></p>
    <p v-if="deadline?.level==='overdue'" class="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800" role="alert"><AlertTriangle :size="17" class="mr-1 inline"/> Hồ sơ đã quá hạn {{Math.abs(deadline.daysLeft||0)}} ngày. Bạn có quyền gửi yêu cầu xem xét.</p>
    <p v-else-if="deadline?.level==='approaching'" class="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900" role="status"><AlertTriangle :size="17" class="mr-1 inline"/> Hồ sơ sắp đến hạn (còn {{deadline.daysLeft}} ngày).</p>
    <p v-else class="text-sm text-muted">{{caseData.status==='draft'?'Hạn xử lý chỉ được tính sau khi nộp.':'Chưa phát hiện cảnh báo gần hạn hoặc quá hạn từ dữ liệu đã lưu.'}}</p>
    <div v-if="deadline?.explanation" class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><b>Lý do do cơ quan cập nhật</b><p class="mt-1 whitespace-pre-wrap break-words">{{deadline.explanation.reason}}</p><p class="mt-2 text-xs text-muted">{{deadline.explanation.stage_name}} · {{deadline.explanation.unit_name}} · {{dateTime(deadline.explanation.created_at)}}</p></div>
    <p class="text-xs text-muted">{{deadline?.notice}}</p>
    <p v-if="deadlineError" class="text-sm text-rose-700">Không tải được cảnh báo. <button type="button" class="underline" @click="refreshDeadline()">Tải lại</button></p>
   </section>
   <section v-if="canRequest" class="panel space-y-4 p-5" aria-labelledby="request-heading">
    <h3 id="request-heading" class="section-label"><FilePenLine :size="18"/>Gửi đề nghị về hồ sơ</h3>
    <form class="space-y-3" @submit.prevent="submitRequest">
     <fieldset class="grid gap-2"><legend class="field-label">Loại đề nghị</legend>
      <label v-for="item in options" :key="item.value" class="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 text-sm"><input v-model="kind" type="radio" :value="item.value" class="mt-1"/><span><b class="block">{{item.title}}</b><span class="text-xs text-muted">{{item.description}}</span></span></label>
     </fieldset>
     <label for="request-reason" class="field-label">Lý do cụ thể</label>
     <textarea id="request-reason" v-model="reason" class="field" rows="4" maxlength="2000" minlength="10" required placeholder="Mô tả vấn đề, thông tin cần điều chỉnh hoặc lý do đề nghị rút..."/>
     <label v-if="kind==='withdrawal'" class="flex items-start gap-2 text-sm"><input v-model="withdrawConfirmed" type="checkbox" class="mt-1"/><span>Tôi hiểu rằng đây chỉ là <b>đề nghị rút hồ sơ</b>, chưa có hiệu lực đến khi cơ quan chấp thuận.</span></label>
     <button class="btn-primary" type="submit" :disabled="loading||reason.trim().length<10||(kind==='withdrawal'&&!withdrawConfirmed)"><Send :size="16"/>{{loading?'Đang gửi...':'Gửi đề nghị'}}</button>
    </form>
   </section>
   <section v-if="['rejected','completed','withdrawn'].includes(caseData.status)" class="panel space-y-3 p-5">
    <h3 class="section-label"><RotateCcw :size="18"/>Tạo hồ sơ mới từ hồ sơ này</h3>
    <p class="text-sm text-muted">Dữ liệu kê khai được sao chép sang <b>bản nháp mới</b> sau khi kiểm tra quyền đại diện. Không sao chép giấy tờ; bạn phải rà soát và nộp chính thức lại.</p>
    <button type="button" class="btn-primary" :disabled="loading" @click="reapply"><RotateCcw :size="16"/>Tạo bản nháp mới</button>
   </section>
   <p v-if="message" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-800">{{message}}</p>
   <p v-if="errorText" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{errorText}}</p>
   <section class="panel space-y-3 p-5"><h3 class="section-label"><ShieldCheck :size="18"/>Lịch sử đề nghị và phản hồi</h3>
    <p v-if="!requests?.items.length" class="text-sm text-muted">Chưa có đề nghị nào.</p>
    <div v-for="r in requests?.items||[]" :key="r.id" class="rounded-lg border border-slate-200 p-3 text-sm"><div class="flex flex-wrap items-center justify-between gap-2"><b>{{r.request_kind==='deadline_review'?'Xem xét chậm hạn':r.request_kind==='amendment'?'Chỉnh sửa':r.request_kind==='withdrawal'?'Rút hồ sơ':'Chuyển cơ quan'}}</b><span :class="r.status==='pending'?'text-amber-800':r.status==='approved'?'text-green-800':'text-rose-700'" class="text-xs font-bold">{{r.status==='pending'?'Chờ cán bộ':r.status==='approved'?'Được chấp thuận':'Không chấp thuận'}}</span></div>
     <p class="mt-2 whitespace-pre-wrap break-words">{{r.reason}}</p><p v-if="r.staff_response" class="mt-2 rounded-lg bg-slate-50 p-2">Phản hồi: {{r.staff_response}}</p><p class="mt-2 text-xs text-muted">{{dateTime(r.created_at)}}</p></div>
   </section>
  </template>
 </div>
</template>
