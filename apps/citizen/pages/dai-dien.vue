<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { UserRoundCheck, ShieldCheck, FileUp, History, RefreshCw, AlertTriangle } from 'lucide-vue-next'
import type { Procedure } from '~/types/models'
type Representation = {id:string;represented_name:string;relationship:string;legal_basis:string;authorization_reference:string;procedure_id:string;procedure_title:string;valid_until:string;status:string;verified_at:string|null;evidence_name:string|null;created_at:string}
type Audit = {id:number;action:string;application_id:string|null;actor_name:string;created_at:string}
const {data:procedures}=await useFetch<Procedure[]>('/api/procedures',{key:'citizen-procedures'})
const {data:list,error,refresh,pending}=await useFetch<{items:Representation[]}>('/api/representations',{key:'citizen-representations',default:()=>({items:[]})})
const form=reactive({representedName:'',relationship:'child',legalBasis:'authorization',authorizationReference:'',procedureId:'',validUntil:''})
const chosenFile=ref<File|null>(null)
const loading=ref(false)
const message=ref('')
const failure=ref('')
const auditId=ref('')
const audit=ref<Audit[]>([])
const auditBusy=ref(false)
const actionLabels:Record<string,string>={requested:'Đăng ký',evidence_uploaded:'Bổ sung minh chứng',verified:'Đã xác minh',rejected:'Không chấp thuận',revoked:'Đã thu hồi',application_created:'Tạo hồ sơ đại diện',application_submitted:'Nộp hồ sơ đại diện'}
const statusLabel:Record<string,string>={pending:'Chờ xác minh',verified:'Đã xác minh',rejected:'Không được chấp thuận',revoked:'Đã thu hồi'}
const relationshipLabel:Record<string,string>={parent:'Cha/mẹ',child:'Con',spouse:'Vợ/chồng',guardian:'Người giám hộ',other:'Quan hệ khác'}
const time=(value:string)=>new Date(value).toLocaleString('vi-VN')
const date=(value:string)=>new Date(value).toLocaleDateString('vi-VN')
function fileChanged(event:Event){chosenFile.value=(event.target as HTMLInputElement).files?.[0]||null}
function issueOf(e:unknown){return (e as {data?:{statusMessage?:string};message?:string})?.data?.statusMessage||'Không thể thực hiện, vui lòng thử lại'}
async function sendEvidence(id:string,file:File){
  const data=new FormData();data.append('file',file)
  await $fetch(`/api/representations/${encodeURIComponent(id)}/evidence`,{method:'POST',body:data})
}
async function register(){
  if(loading.value)return
  loading.value=true;message.value='';failure.value=''
  try{
    const created=await $fetch<{id:string}>('/api/representations',{method:'POST',body:form})
    let uploadFailed=false
    if(chosenFile.value){
      try{await sendEvidence(created.id,chosenFile.value)}catch(e){uploadFailed=true;failure.value=`Đã lưu đăng ký nhưng chưa tải được minh chứng: ${issueOf(e)}. Hãy tải lại trong danh sách bên dưới.`}
    }
    if(!uploadFailed)message.value='Đã ghi nhận yêu cầu. Chỉ được đại diện nộp hồ sơ sau khi người có thẩm quyền kiểm tra và chấp thuận minh chứng.'
    Object.assign(form,{representedName:'',relationship:'child',legalBasis:'authorization',authorizationReference:'',procedureId:'',validUntil:''})
    chosenFile.value=null
    await refresh()
  }catch(e){failure.value=issueOf(e)}finally{loading.value=false}
}
async function uploadFor(id:string,event:Event){
  const file=(event.target as HTMLInputElement).files?.[0]
  if(!file)return
  failure.value='';message.value=''
  try{await sendEvidence(id,file);message.value='Đã gửi minh chứng, yêu cầu vẫn ở trạng thái chờ xác minh.';await refresh()}
  catch(e){failure.value=issueOf(e)}finally{(event.target as HTMLInputElement).value=''}
}
async function revoke(id:string){
  if(!window.confirm('Bạn có chắc muốn thu hồi yêu cầu/quyền đại diện này? Hồ sơ đã nộp vẫn được lưu để kiểm tra.'))return
  failure.value='';message.value=''
  try{await $fetch(`/api/representations/${id}/revoke`,{method:'POST'});message.value='Đã thu hồi quyền đại diện.';await refresh()}
  catch(e){failure.value=issueOf(e)}
}
async function history(id:string){
  if(auditId.value===id){auditId.value='';return}
  auditId.value=id;auditBusy.value=true;failure.value=''
  try{audit.value=await $fetch<Audit[]>(`/api/representations/${id}/audit`)}catch(e){audit.value=[];failure.value=issueOf(e)}finally{auditBusy.value=false}
}
</script>
<template>
 <div class="space-y-4">
  <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 class="text-xl font-black text-brand-900">Đại diện thực hiện thủ tục cho người thân</h2><p class="mt-1 text-sm text-muted">Đăng ký căn cứ đại diện hoặc ủy quyền, theo dõi xác minh và xem lịch sử thao tác.</p></div><NuxtLink to="/ho-so" class="btn-outline text-sm">Hồ sơ của tôi</NuxtLink></div>
  <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900" role="note"><AlertTriangle :size="17" class="mr-1 inline"/>Đăng ký và tải giấy tờ <b>không tự động tạo quyền đại diện</b>. Chỉ quyền có trạng thái <b>Đã xác minh</b>, còn hạn và đúng thủ tục mới được dùng để nộp. Bản demo chưa có giao diện xét duyệt dành cho cán bộ.</div>
  <section class="panel p-4 sm:p-5" aria-labelledby="rep-form-title">
   <div class="mb-4 flex items-center gap-2"><UserRoundCheck :size="21" class="text-brand-700"/><h3 id="rep-form-title" class="text-base font-black">Đăng ký người được đại diện</h3></div>
   <form class="grid gap-4 sm:grid-cols-2" @submit.prevent="register">
    <div><label class="field-label" for="rep-name">Họ và tên người được đại diện *</label><input id="rep-name" v-model="form.representedName" class="field" required minlength="2" maxlength="120" autocomplete="off"/></div>
    <div><label class="field-label" for="rep-relationship">Quan hệ với người được đại diện *</label><select id="rep-relationship" v-model="form.relationship" class="field"><option value="child">Con</option><option value="parent">Cha/mẹ</option><option value="spouse">Vợ/chồng</option><option value="guardian">Người giám hộ</option><option value="other">Quan hệ khác</option></select></div>
    <div><label class="field-label" for="rep-basis">Căn cứ đại diện *</label><select id="rep-basis" v-model="form.legalBasis" class="field"><option value="authorization">Văn bản ủy quyền</option><option value="legal_representative">Đại diện theo pháp luật</option></select></div>
    <div><label class="field-label" for="rep-ref">Số/ký hiệu giấy tờ (nếu có)</label><input id="rep-ref" v-model="form.authorizationReference" class="field" maxlength="120" autocomplete="off"/></div>
    <div><label class="field-label" for="rep-procedure">Phạm vi: thủ tục được đại diện *</label><select id="rep-procedure" v-model="form.procedureId" class="field" required><option value="">Chọn thủ tục</option><option v-for="p in procedures||[]" :key="p.id" :value="p.id">{{p.title}}</option></select></div>
    <div><label class="field-label" for="rep-expiry">Ngày hết hạn cần xác minh *</label><input id="rep-expiry" v-model="form.validUntil" class="field" type="date" required/></div>
    <div class="sm:col-span-2"><label class="field-label" for="rep-proof">Minh chứng đại diện (PDF, PNG, JPG; tối đa 5 MB)</label><input id="rep-proof" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="field" @change="fileChanged"/><p class="mt-1 text-xs text-muted">Tệp chỉ được xem từ tài khoản đăng ký và quy trình xét duyệt được phân quyền. Không sử dụng liên kết tải lên để chuyển tiếp công khai.</p></div>
    <div class="sm:col-span-2 flex flex-wrap items-center gap-2"><button class="btn-primary" type="submit" :disabled="loading"><FileUp :size="16"/>{{loading?'Đang gửi...':'Gửi yêu cầu đại diện'}}</button><p class="text-xs text-slate-600">Thông tin cần được kiểm tra bởi bên có thẩm quyền.</p></div>
   </form>
  </section>
  <p v-if="message" role="status" class="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{{message}}</p>
  <p v-if="failure" role="alert" class="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{{failure}}</p>
  <section class="panel p-4 sm:p-5" aria-labelledby="rep-list-title">
   <div class="mb-3 flex items-center justify-between gap-3"><h3 id="rep-list-title" class="section-label !mb-0"><ShieldCheck :size="18"/>Danh sách quyền đại diện</h3><button type="button" class="btn-outline !py-1.5" @click="refresh()"><RefreshCw :size="14"/>Tải lại</button></div>
   <p v-if="error" role="alert" class="text-sm text-rose-700">Không thể tải danh sách đại diện.</p>
   <p v-else-if="!list?.items?.length" class="p-4 text-sm text-muted">Chưa có yêu cầu đại diện nào.</p>
   <div v-for="item in list?.items||[]" :key="item.id" class="mb-3 rounded-xl border border-slate-200 p-3 last:mb-0 sm:p-4">
    <div class="flex flex-wrap items-start justify-between gap-2"><div><h4 class="font-extrabold text-brand-900">{{item.represented_name}}</h4><p class="mt-1 text-xs text-slate-600">{{relationshipLabel[item.relationship]}} · {{item.procedure_title}}</p><p class="mt-1 text-xs text-slate-600">Hạn đại diện: {{date(item.valid_until)}} · Căn cứ: {{item.legal_basis==='authorization'?'Ủy quyền':'Đại diện theo pháp luật'}}</p></div><span :class="['rounded-full px-3 py-1 text-xs font-bold',item.status==='verified'?'bg-green-100 text-green-800':item.status==='pending'?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-700']">{{item.status==='verified' && item.valid_until<new Date().toISOString().slice(0,10)?'Đã hết hạn':statusLabel[item.status]}}</span></div>
    <div class="mt-2 flex flex-wrap items-center gap-3 text-xs"><a v-if="item.evidence_name" :href="`/api/representations/${item.id}/evidence`" class="font-semibold text-brand-700 underline">Xem minh chứng: {{item.evidence_name}}</a><label v-if="item.status==='pending'" class="cursor-pointer font-semibold text-brand-700 underline">{{item.evidence_name?'Thay minh chứng':'Tải minh chứng'}}<input class="sr-only" type="file" accept=".pdf,.png,.jpg,.jpeg" @change="uploadFor(item.id,$event)"/></label><NuxtLink v-if="item.status==='verified' && item.valid_until>=new Date().toISOString().slice(0,10)" :to="`/nop-ho-so/${item.procedure_id}?representation=${item.id}`" class="font-bold text-brand-700 underline">Thực hiện thủ tục</NuxtLink><button type="button" class="font-semibold text-brand-700 underline" :aria-expanded="auditId===item.id" @click="history(item.id)"><History :size="13" class="inline"/> Lịch sử</button><button v-if="!['revoked'].includes(item.status)" type="button" class="font-semibold text-rose-700 underline" @click="revoke(item.id)">Thu hồi</button></div>
    <div v-if="auditId===item.id" class="mt-3 rounded-lg bg-slate-50 p-3 text-xs"><p v-if="auditBusy">Đang tải lịch sử...</p><p v-else-if="!audit.length">Chưa có thao tác được ghi nhận.</p><ul v-else class="space-y-2"><li v-for="entry in audit" :key="entry.id" class="flex flex-wrap justify-between gap-2 border-b border-slate-200 pb-2 last:border-0"><span>{{actionLabels[entry.action]||entry.action}}<span v-if="entry.application_id"> · {{entry.application_id}}</span></span><time>{{time(entry.created_at)}}</time></li></ul></div>
   </div>
  </section>
 </div>
</template>
