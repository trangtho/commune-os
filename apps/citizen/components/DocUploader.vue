<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { CheckCircle2, UploadCloud, FileText, LoaderCircle } from 'lucide-vue-next'
import type { CaseDocument,ProcedureDocument } from '~/types/models'
const props=defineProps<{applicationId:string;requirements:ProcedureDocument[];uploaded:CaseDocument[]}>()
const emit=defineEmits<{(e:'uploaded',value:CaseDocument):void}>()
const busy=ref('');const errorText=ref('')
const latest=(code:string)=>props.uploaded.find(d=>d.document_code===code)
const done=(code:string)=>Boolean(latest(code))
async function onFile(e:Event,code:string){
  const input=e.target as HTMLInputElement
  const file=input.files?.[0];if(!file)return
  errorText.value=''
  if(!['application/pdf','image/png','image/jpeg'].includes(file.type)||file.size===0||file.size>5*1024*1024){errorText.value='Chỉ nhận PDF/JPG/PNG, dung lượng từ 1 byte đến 5 MB';input.value='';return}
  busy.value=code
  try {const form=new FormData();form.set('file',file);form.set('documentCode',code);const result=await $fetch<CaseDocument>(`/api/applications/${props.applicationId}/documents`,{method:'POST',body:form});emit('uploaded',result)}
  catch(e){errorText.value=readableError(e)}finally{busy.value='';input.value=''}
}
</script>
<template><div class="space-y-3"><div v-for="req in requirements" :key="req.document_code" class="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"><span :class="['grid h-9 w-9 place-items-center rounded-lg',done(req.document_code)?'bg-green-50 text-green-600':'bg-blue-50 text-blue-600']"><CheckCircle2 v-if="done(req.document_code)" :size="20"/><FileText v-else :size="20"/></span><div class="min-w-0 flex-[1_1_180px] break-words"><p class="text-sm font-bold">{{req.document_name}} <span v-if="req.is_required" class="text-red-500">*</span></p><p class="break-all text-xs text-muted">{{latest(req.document_code)?.original_name || 'Chưa có tệp'}}</p></div><label class="btn-outline w-full cursor-pointer !px-3 !py-2 !text-xs sm:w-auto"><LoaderCircle v-if="busy===req.document_code" :size="15" class="animate-spin"/><UploadCloud v-else :size="15"/> {{done(req.document_code)?'Tải bản mới':'Chọn tệp'}}<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" class="hidden" :disabled="!!busy" @change="onFile($event,req.document_code)"/></label></div><p v-if="errorText" role="alert" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{{errorText}}</p><p class="text-xs text-slate-500">Chỉ dùng tệp giả lập để thử nghiệm. Chấp nhận PDF, PNG, JPG tối đa 5 MB/tệp.</p></div></template>
