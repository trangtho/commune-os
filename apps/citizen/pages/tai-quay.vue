<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ClipboardList,Clock3,FileText,ShieldAlert,RefreshCw,Printer,LogIn } from 'lucide-vue-next'
import type {Procedure} from '~/types/models'
type CounterSession={active:boolean;code?:string;procedureId?:string;procedureTitle?:string;expiresAt?:string}
const {data:procedures,error:procedureError,refresh:reloadProcedures}=await useFetch<Procedure[]>('/api/procedures',{key:'citizen-procedures'})
const {data:session,refresh:refreshSession}=await useFetch<CounterSession>('/api/counter/sessions/current',{key:'citizen-counter-current',default:()=>({active:false})})
const selected=ref('')
const checkedDocs=ref<string[]>([])
const {data:detail,error:detailError,refresh:reloadDetail}=await useAsyncData<Procedure|null>('citizen-counter-procedure-detail',()=>selected.value?$fetch<Procedure>(`/api/procedures/${encodeURIComponent(selected.value)}`):Promise.resolve(null),{watch:[selected],default:()=>null})
const busy=ref(false)
const errorText=ref('')
const now=ref(Date.now())
let ticker:ReturnType<typeof setInterval>|undefined
onMounted(()=>{ticker=setInterval(()=>{now.value=Date.now();if(session.value?.active&&new Date(session.value.expiresAt||0).getTime()<=now.value)void refreshSession()},1000)})
onUnmounted(()=>{if(ticker)clearInterval(ticker)})
watch(selected,()=>{checkedDocs.value=[]})
watch(session,value=>{if(value?.active && value.procedureId)selected.value=value.procedureId},{immediate:true})
const selectedProcedure=computed(()=>detail.value?.id===selected.value?detail.value:procedures.value?.find(p=>p.id===selected.value))
const secondsLeft=computed(()=>Math.max(0,Math.ceil((new Date(session.value?.expiresAt||0).getTime()-now.value)/1000)))
const active=computed(()=>Boolean(session.value?.active&&secondsLeft.value>0))
const showCode=computed(()=>session.value?.code?.match(/.{1,5}/g)?.join('-')||'')
function message(e:unknown){return (e as {data?:{statusMessage?:string}})?.data?.statusMessage||'Không thể tạo phiên. Vui lòng thử lại.'}
function printChecklist(){if(import.meta.client)window.print()}
async function createSession(){if(busy.value||!selected.value)return;busy.value=true;errorText.value=''
 try{await $fetch('/api/counter/sessions',{method:'POST',body:{procedureId:selected.value}});await refreshSession()}catch(e){errorText.value=message(e)}finally{busy.value=false}}
async function endSession(){if(busy.value)return;busy.value=true;errorText.value=''
 try{await $fetch('/api/counter/sessions/current',{method:'DELETE'});await refreshSession();selected.value='';checkedDocs.value=[]}catch(e){errorText.value=message(e)}finally{busy.value=false}}
</script>
<template>
 <div class="space-y-4">
  <div><h2 class="text-xl font-black text-brand-900">Hỗ trợ thủ tục tại quầy</h2><p class="mt-1 text-sm text-muted">Tra cứu và chuẩn bị giấy tờ trước khi gặp cán bộ tiếp nhận, không cần tài khoản.</p></div>
  <div class="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-900" role="note"><ShieldAlert :size="18" class="mr-1 inline"/><b>Chế độ chuẩn bị, không phải nộp hồ sơ.</b> Mã phiên chỉ ghi nhận thủ tục đã chọn, <b>không xác thực danh tính, không lưu thông tin cá nhân</b> và không cấp quyền xem hồ sơ. Nếu cần nộp hoặc tra cứu hồ sơ, phải đăng nhập hoặc được cán bộ xác minh theo quy trình.</div>
  <section class="panel space-y-4 p-4 sm:p-5">
   <h3 class="section-label"><ClipboardList :size="19"/>Bước 1. Chọn thủ tục cần thực hiện</h3>
   <p v-if="procedureError" role="alert" class="text-sm text-rose-700">Không tải được danh mục thủ tục. <button class="font-bold underline" @click="reloadProcedures()"><RefreshCw :size="14" class="inline"/>Thử lại</button></p>
   <form class="flex flex-wrap items-end gap-3" @submit.prevent="createSession"><div class="min-w-[220px] flex-1"><label for="counter-procedure" class="field-label">Thủ tục hành chính</label><select id="counter-procedure" v-model="selected" class="field" :disabled="active" required><option value="">Chọn một thủ tục</option><option v-for="item in procedures||[]" :key="item.id" :value="item.id">{{item.title}}</option></select></div><button type="submit" class="btn-primary w-full sm:w-auto" :disabled="busy||!selected||active"><Clock3 :size="16"/>{{active?'Đã tạo phiên':'Tạo mã phiên 15 phút'}}</button></form>
   <p v-if="errorText" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{errorText}}</p>
   <div v-if="active" class="rounded-xl border border-green-200 bg-green-50 p-4" role="status"><p class="text-xs font-bold uppercase text-green-800">Mã phiên chuẩn bị tại quầy</p><p class="mt-2 break-all font-mono text-xl font-black tracking-wider text-green-950 sm:text-2xl">{{showCode}}</p><p class="mt-2 text-sm text-green-800">Còn hiệu lực: {{Math.floor(secondsLeft/60)}} phút {{secondsLeft%60}} giây. Cung cấp mã cho cán bộ để tra cứu <b>thủ tục đã chọn</b>, không dùng như mã xác minh công dân.</p><button type="button" class="btn-outline mt-3" :disabled="busy" @click="endSession">Kết thúc và xóa phiên</button></div>
   <p v-else-if="session?.active" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Phiên đã hết hạn. Vui lòng kết thúc phiên và tạo lại.</p>
  </section>
  <section v-if="selectedProcedure" class="panel p-4 sm:p-5" aria-labelledby="counter-checklist"><h3 id="counter-checklist" class="section-label"><FileText :size="19"/>Bước 2. Xem thông tin và giấy tờ chuẩn bị</h3><h4 class="font-extrabold text-brand-900">{{selectedProcedure.title}}</h4><p class="mt-2 text-sm text-slate-700">{{selectedProcedure.summary}}</p><dl class="mt-3 grid gap-3 sm:grid-cols-2"><div class="rounded-lg bg-slate-50 p-3 text-sm"><dt class="text-xs font-bold text-slate-500">Thời hạn tham khảo</dt><dd>{{selectedProcedure.sla_days}} ngày</dd></div><div class="rounded-lg bg-slate-50 p-3 text-sm"><dt class="text-xs font-bold text-slate-500">Lệ phí tham khảo</dt><dd>{{selectedProcedure.fee_note}}</dd></div></dl><h5 class="mt-4 text-sm font-bold">Giấy tờ cần chuẩn bị</h5><p v-if="detailError" role="alert" class="mt-2 text-xs text-rose-700">Không tải được danh sách giấy tờ. <button class="font-bold underline" type="button" @click="reloadDetail()">Thử lại</button></p><ul class="mt-2 list-inside list-disc space-y-2 text-sm text-slate-700"><li v-for="doc in selectedProcedure.documents||[]" :key="doc.document_code" class="list-none"><label class="flex cursor-pointer items-start gap-2"><input v-model="checkedDocs" type="checkbox" :value="doc.document_code" class="mt-0.5"/><span>{{doc.document_name}} <span v-if="doc.is_required" class="text-rose-700">(bắt buộc)</span></span></label></li></ul><p v-if="selectedProcedure.documents?.length" class="mt-2 text-xs text-slate-600">Đã đánh dấu {{checkedDocs.length}}/{{selectedProcedure.documents.length}} giấy tờ. Danh sách đánh dấu chỉ tồn tại trên màn hình này, không được gửi đến máy chủ.</p><p v-if="!selectedProcedure.documents?.length&&!detailError" class="text-sm text-muted">Chưa có danh mục giấy tờ được công bố.</p><p v-if="selectedProcedure.instructions" class="mt-3 whitespace-pre-line rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{{selectedProcedure.instructions}}</p><div class="mt-4 flex flex-wrap gap-2"><NuxtLink :to="`/thu-tuc/${selectedProcedure.id}`" class="btn-outline">Xem chi tiết thủ tục</NuxtLink><button type="button" class="btn-outline" @click="printChecklist"><Printer :size="15"/>In danh sách chuẩn bị</button></div></section>
  <section class="panel space-y-3 p-4 sm:p-5"><h3 class="section-label"><LogIn :size="19"/>Bước 3. Xác minh khi nộp hồ sơ</h3><p class="text-sm text-slate-700">Bạn có thể đem danh sách giấy tờ đến cán bộ một cửa. Để nộp hồ sơ trực tuyến hoặc truy cập dữ liệu cá nhân, hãy đăng nhập. Cán bộ cần tự xác minh danh tính và thẩm quyền theo quy trình được phê duyệt.</p><NuxtLink to="/dang-nhap" class="btn-primary inline-flex">Đăng nhập để tiếp tục</NuxtLink></section>
 </div>
</template>
