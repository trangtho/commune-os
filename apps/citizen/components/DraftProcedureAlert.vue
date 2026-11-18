<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {AlertTriangle,CheckCircle2,ExternalLink} from 'lucide-vue-next'
import {changeLabels,type ChangeSection} from '~/shared/procedure-versions'
const props=defineProps<{draftId:string}>()
const emit=defineEmits<{status:[needsReview:boolean];reviewed:[]}>()
type Change={needsReview:boolean;currentVersion:number;currentId:string;reviewedVersion:number|null;
 changedSections:ChangeSection[];changeNote:string;sourceUrl:string|null;provenanceStatus:string;sourceReference:string|null}
const {data,pending,error,refresh}=await useFetch<Change>(
 ()=>`/api/applications/${encodeURIComponent(props.draftId||'missing')}/procedure-change`,
 {key:`draft-procedure-change:${props.draftId}`,immediate:Boolean(props.draftId),watch:[()=>props.draftId]})
// Keep submission disabled while the change check is loading or has failed.
// The server separately rechecks the latest version at final submission.
watch([data,pending,error],()=>emit('status',
 !data.value||Boolean(pending.value)||Boolean(error.value)||Boolean(data.value.needsReview)),{immediate:true})
const readConfirmed=ref(false)
const saving=ref(false)
const errorText=ref('')
async function acknowledge(){
 if(!readConfirmed.value||!data.value||saving.value)return
 saving.value=true;errorText.value=''
 try{
  await $fetch(`/api/applications/${encodeURIComponent(props.draftId)}/procedure-change/ack`,{
   method:'POST',body:{currentVersionId:data.value.currentId,reviewed:true}})
  await refresh();readConfirmed.value=false;emit('reviewed')
 }catch(e){errorText.value=readableError(e)}finally{saving.value=false}
}
</script>
<template>
 <section v-if="props.draftId" :class="['panel space-y-3 p-4',data?.needsReview?'border-amber-300 bg-amber-50':'border-blue-100']" aria-label="Kiểm tra phiên bản thủ tục">
  <p v-if="pending" class="text-xs text-muted">Đang đối chiếu bản nháp với quy định mới nhất...</p>
  <p v-else-if="error" role="alert" class="text-sm text-rose-700">Chưa thể kiểm tra phiên bản quy định. Hãy thử lại trước khi nộp. <button type="button" class="font-bold underline" @click="refresh()">Thử lại</button></p>
  <template v-else-if="data?.needsReview">
   <h3 class="flex items-center gap-2 text-base font-extrabold text-amber-900"><AlertTriangle :size="20"/> Thủ tục đã thay đổi từ khi lưu bản nháp</h3>
   <p class="text-sm text-amber-900">Bản đã xem: {{data.reviewedVersion||'Chưa xác định'}} · Phiên bản mới: <strong>{{data.currentVersion}}</strong>. Vui lòng rà soát trước khi nộp.</p>
   <p v-if="data.changeNote" class="text-sm text-slate-700">{{data.changeNote}}</p>
   <ul v-if="data.changedSections?.length" class="list-inside list-disc space-y-1 text-sm text-slate-800"><li v-for="section in data.changedSections" :key="section">{{changeLabels[section]||section}} cần kiểm tra lại</li></ul>
   <a v-if="data.sourceUrl" :href="data.sourceUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sm font-bold text-brand-700 underline">Xem nguồn: {{data.sourceReference||'Văn bản công bố'}} <ExternalLink :size="14"/></a>
   <p v-else class="text-xs text-amber-800">Chưa có nguồn đã xác minh; chỉ nên sử dụng trong bản demo.</p>
   <label class="flex items-start gap-2 text-sm"><input v-model="readConfirmed" type="checkbox" class="mt-1"/><span>Tôi đã kiểm tra lại biểu mẫu, thành phần giấy tờ, lệ phí và thời hạn; hiểu rằng có thể phải chỉnh sửa bản nháp.</span></label>
   <button type="button" class="btn-primary" :disabled="saving||!readConfirmed" @click="acknowledge">{{saving?'Đang xác nhận...':'Xác nhận đã rà soát phiên bản mới'}}</button>
   <p v-if="errorText" role="alert" class="text-sm text-rose-700">{{errorText}}</p>
  </template>
  <p v-else-if="data" class="flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 :size="17"/> Đã kiểm tra phiên bản thủ tục {{data.currentVersion}}. Hãy đối chiếu lại giấy tờ trước khi nộp.</p>
 </section>
</template>
