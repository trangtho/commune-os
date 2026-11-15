<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ArrowLeft,AlertCircle,UploadCloud,CheckCircle2} from 'lucide-vue-next'
import type {Application,CaseDocument,ProcedureDocument} from '~/types/models'
interface SupplementItem {id:string;kind:'document'|'field';target_key:string;instruction:string;reason:string;citizen_response:string|null;document_id:string|null;responded_at:string|null;created_at:string}
const id=String(useRoute().params.id)
const {data:c,error,refresh}=await useFetch<Application&{requirements:ProcedureDocument[]}>(`/api/applications/${encodeURIComponent(id)}`,{key:`citizen-application:${id}`})
const {data:requests,error:requestsError,refresh:refreshRequests}=await useFetch<{items:SupplementItem[];structured:boolean}>(`/api/applications/${encodeURIComponent(id)}/supplement`,{key:`citizen-supplement:${id}`})
const busy=ref(false),saving=ref(''),errorText=ref(''),notice=ref('')
const responses=reactive<Record<string,string>>({})
const documents=reactive<Record<string,string>>({})
function removeDocument(documentId:string){if(c.value?.documents)c.value.documents=c.value.documents.filter(d=>d.id!==documentId)}
function eligibleDocs(item:SupplementItem):CaseDocument[]{return (c.value?.documents||[]).filter(d=>d.document_code===item.target_key && new Date(d.uploaded_at).getTime()>new Date(item.created_at).getTime())}
const lastSupplementTime=computed(()=>Math.max(0,...(c.value?.events||[]).filter(e=>e.event_type==='supplement').map(e=>Date.parse(e.created_at)||0)))
const hasNewDocuments=computed(()=>Boolean(c.value?.documents?.some(d=>(Date.parse(d.uploaded_at)||0)>lastSupplementTime.value)))
const hasStructured=computed(()=>Boolean(requests.value?.structured))
const completeItems=computed(()=>requests.value?.items.every(item=>item.kind==='field'?Boolean(item.citizen_response?.trim()):Boolean(item.document_id&&eligibleDocs(item).some(d=>d.id===item.document_id)))??false)
const canSubmit=computed(()=>hasStructured.value?completeItems.value:hasNewDocuments.value)
async function saveItem(item:SupplementItem){
 saving.value=item.id;errorText.value='';notice.value=''
 try{
  if(item.kind==='field'&&!responses[item.id]?.trim())throw new Error('Vui lòng nhập nội dung giải trình.')
  if(item.kind==='document'&&!documents[item.id])throw new Error('Vui lòng chọn tệp đã tải lên đúng loại giấy tờ.')
  await $fetch(`/api/applications/${encodeURIComponent(id)}/supplement/${encodeURIComponent(item.id)}`,{method:'POST',body:item.kind==='field'?{response:responses[item.id].trim()}:{documentId:documents[item.id]}})
  await refreshRequests();notice.value='Đã lưu mục bổ sung.'
 }catch(e){errorText.value=readableError(e)}finally{saving.value=''}
}
async function complete(){
 if(busy.value||!canSubmit.value)return
 busy.value=true;errorText.value='';notice.value=''
 try{await $fetch(`/api/applications/${encodeURIComponent(id)}/complete-supplement`,{method:'POST'});await refresh();await navigateTo(`/ho-so/${encodeURIComponent(id)}`)}
 catch(e){errorText.value=readableError(e)}finally{busy.value=false}
}
</script>
<template>
 <div class="space-y-4"><NuxtLink :to="`/ho-so/${encodeURIComponent(id)}`" class="inline-flex items-center gap-1 text-sm text-brand-700"><ArrowLeft :size="16"/>Chi tiết hồ sơ</NuxtLink>
  <div v-if="error" class="panel p-6 text-rose-700" role="alert">Không tải được hồ sơ.</div>
  <template v-else-if="c">
   <div class="panel p-5"><h2 class="text-xl font-black">Bổ sung hồ sơ {{id}}</h2><p class="mt-1 text-sm text-muted">{{c.procedure_title}}</p>
    <div class="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><AlertCircle :size="18" class="mr-2 inline"/>Hãy đọc lý do từng yêu cầu và chuẩn bị nội dung hoặc giấy tờ đúng mục. Cán bộ sẽ xác minh sau khi bạn gửi.</div></div>
   <section v-if="c.status==='supplement'" class="panel space-y-4 p-4 sm:p-5">
    <div v-if="requestsError" role="alert" class="text-sm text-rose-700">Không tải được yêu cầu chi tiết. <button class="font-bold underline" @click="refreshRequests()">Thử lại</button></div>
    <template v-else>
     <div v-if="hasStructured" class="space-y-4"><h3 class="section-label">Danh sách yêu cầu từ cán bộ ({{requests?.items.length}} mục)</h3>
      <div v-for="(item,index) in requests?.items||[]" :key="item.id" class="rounded-xl border border-slate-200 p-4">
       <div class="flex flex-wrap justify-between gap-2"><h4 class="font-bold text-brand-900">{{index+1}}. {{item.kind==='document'?'Bổ sung giấy tờ':'Giải trình thông tin'}} · {{item.target_key}}</h4>
        <span v-if="item.responded_at" class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-800"><CheckCircle2 :size="13"/>Đã hoàn thành</span>
        <span v-else class="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Chưa hoàn thành</span></div>
       <p class="mt-2 text-sm">{{item.instruction}}</p><p class="mt-1 text-xs text-rose-800"><b>Lý do:</b> {{item.reason}}</p>
       <div v-if="item.kind==='field'" class="mt-3 space-y-2"><label :for="`supplement-field-${item.id}`" class="field-label">Thông tin giải trình</label><textarea :id="`supplement-field-${item.id}`" v-model="responses[item.id]" class="field" rows="3" maxlength="1000" :placeholder="item.citizen_response||'Nhập nội dung giải trình'"/><p v-if="item.citizen_response" class="text-xs text-green-800">Đã lưu: {{item.citizen_response}}</p></div>
       <div v-else class="mt-3"><label class="field-label" :for="`supplement-doc-${item.id}`">Tệp bổ sung đúng loại</label><select :id="`supplement-doc-${item.id}`" v-model="documents[item.id]" class="field"><option value="">Chọn tệp đã tải lên</option><option v-for="file in eligibleDocs(item)" :key="file.id" :value="file.id">{{file.original_name}}</option></select><p v-if="!eligibleDocs(item).length" class="mt-1 text-xs text-muted">Chưa có tệp mới đúng loại. Vui lòng tải ở khung dưới.</p></div>
       <button type="button" class="btn-outline mt-3" :disabled="saving===item.id" @click="saveItem(item)">{{saving===item.id?'Đang lưu...':'Lưu mục bổ sung'}}</button>
      </div>
     </div>
     <p v-else class="text-sm text-amber-900">Cán bộ chưa gửi danh sách chi tiết. Đây là yêu cầu bổ sung theo cách cũ; hãy xem ghi chú trong lịch sử hồ sơ và tải giấy tờ mới. Nếu chưa rõ giấy tờ cần bổ sung, hãy liên hệ cơ quan tiếp nhận.</p>
     <div class="border-t pt-4"><h3 class="section-label"><UploadCloud :size="19" class="text-blue-600"/>Tải tài liệu bổ sung</h3><DocUploader :application-id="id" :requirements="c.requirements||[]" :uploaded="c.documents||[]" @uploaded="refresh()" @deleted="removeDocument"/></div>
     <p v-if="notice" role="status" class="rounded-lg bg-green-50 p-3 text-sm text-green-800">{{notice}}</p>
     <p v-if="errorText" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{{errorText}}</p>
     <p class="text-xs text-muted">{{hasStructured?'Hoàn thành và lưu tất cả mục yêu cầu rồi gửi lại để cán bộ xác minh.':'Cần ít nhất một tệp tải lên sau yêu cầu gần nhất.'}}</p>
     <button class="btn-primary" type="button" :disabled="busy||!canSubmit" @click="complete">{{busy?'Đang gửi...':'Gửi toàn bộ phần bổ sung'}}</button>
    </template>
   </section>
   <div v-else class="panel p-5 text-green-800">Hồ sơ không còn trong trạng thái cần bổ sung. <NuxtLink :to="`/ho-so/${id}`" class="font-bold underline">Xem tiến trình</NuxtLink>.</div>
  </template>
 </div>
</template>
