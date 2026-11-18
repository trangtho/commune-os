<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {BookOpen,ExternalLink,Clock3,ShieldAlert} from 'lucide-vue-next'
import {changeLabels, type ChangeSection} from '~/shared/procedure-versions'
const props=defineProps<{procedureId:string}>()
type Version={id:string;version_no:number;effective_from:string;source_url:string|null;source_title:string|null;
 source_reference:string|null;issuing_authority:string|null;scope_note:string;provenance_status:string;
 change_sections:ChangeSection[];change_note:string;published_at:string}
const {data,pending,error,refresh}=await useFetch<{current:Version|null;versions:Version[]}>(
 ()=>`/api/procedures/${encodeURIComponent(props.procedureId)}/versions`,
 {key:`procedure-versions:${props.procedureId}`})
const expanded=ref(false)
const {date}=useFormat()
</script>
<template>
 <section class="panel space-y-3 p-5" aria-labelledby="legal-source-heading">
  <div class="flex flex-wrap items-start justify-between gap-2"><h3 id="legal-source-heading" class="section-label"><BookOpen :size="20" class="text-brand-600"/> Phiên bản và nguồn công bố</h3><button type="button" class="btn-outline !px-2 !py-1 !text-xs" @click="refresh()">Làm mới</button></div>
  <p v-if="pending" class="text-sm text-muted">Đang tải nguồn và lịch sử...</p>
  <p v-else-if="error" role="alert" class="text-sm text-rose-700">Chưa tải được dữ liệu phiên bản thủ tục.</p>
  <template v-else-if="data?.current">
   <div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
    <p class="font-extrabold text-brand-800">Phiên bản {{data.current.version_no}} · Áp dụng từ {{date(data.current.effective_from)}}</p>
    <p class="mt-1 text-slate-700">Phạm vi: {{data.current.scope_note}}</p>
    <div v-if="data.current.provenance_status==='unverified_demo'" role="status" class="mt-2 flex items-start gap-2 text-amber-800"><ShieldAlert :size="16" class="shrink-0"/> Dữ liệu mô phỏng chưa xác minh nguồn chính thức. Không sử dụng như hướng dẫn có giá trị pháp lý.</div>
    <template v-else><p class="mt-2 text-slate-700"><strong>Cơ quan công bố:</strong> {{data.current.issuing_authority}}</p><p class="text-slate-700"><strong>Văn bản:</strong> {{data.current.source_reference}}</p><a v-if="data.current.source_url" :href="data.current.source_url" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex items-center gap-1 break-all font-bold text-brand-700 underline">Đối chiếu tại nguồn công bố <ExternalLink :size="13"/></a><p class="mt-2 text-xs text-amber-800">Nguồn do đơn vị vận hành khai báo; người sử dụng nên đối chiếu nội dung gốc và phạm vi áp dụng.</p></template>
   </div>
   <button class="flex items-center gap-2 text-sm font-bold text-brand-700 underline" type="button" :aria-expanded="expanded" @click="expanded=!expanded"><Clock3 :size="17"/> {{expanded?'Thu gọn':'Xem lịch sử cập nhật'}} ({{data.versions.length}})</button>
   <div v-if="expanded" class="space-y-2"><article v-for="v in data.versions" :key="v.id" class="rounded-lg border border-slate-200 p-3 text-sm"><p class="font-extrabold">Bản {{v.version_no}} · {{date(v.effective_from)}}</p><p v-if="v.change_note" class="mt-1 text-slate-700">{{v.change_note}}</p><p v-if="v.change_sections.length" class="mt-1 text-xs text-muted">Thay đổi: {{v.change_sections.map(s=>changeLabels[s]||s).join(', ')}}</p><a v-if="v.source_url" :href="v.source_url" rel="noopener noreferrer" target="_blank" class="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand-700 underline">{{v.source_reference||'Nguồn tham khảo'}} <ExternalLink :size="12"/></a><p v-else class="mt-1 text-xs text-amber-700">Chưa có nguồn xác thực</p></article></div>
  </template>
 </section>
</template>
