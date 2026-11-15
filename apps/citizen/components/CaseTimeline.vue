<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {CheckCircle2,Clock3,AlertCircle} from 'lucide-vue-next'
import type {ApplicationStatus} from '~/types/models'
interface Stage {id:string;stage_name:string;unit_name:string;stage_status:'pending'|'active'|'done'|'paused';due_at:string|null;reason:string;staff_name:string;created_at:string}
const props=defineProps<{status:ApplicationStatus;stages?:Stage[]}>()
const {dateTime}=useFormat()
const labels:Record<string,string>={pending:'Chờ thực hiện',active:'Đang thực hiện',done:'Đã hoàn thành',paused:'Tạm dừng'}
const statusLabels:Record<ApplicationStatus,string>={draft:'Bản nháp',submitted:'Đã nộp',processing:'Đang xử lý',supplement:'Cần bổ sung',completed:'Hoàn thành',rejected:'Không chấp thuận'}
const latest=computed(()=>{
 const seen=new Set<string>()
 return [...(props.stages||[])].reverse().filter(s=>{if(seen.has(s.stage_name))return false;seen.add(s.stage_name);return true}).reverse()
})
</script>
<template>
 <div class="space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2"><p class="text-sm">Trạng thái hồ sơ: <b class="text-brand-900">{{statusLabels[status]}}</b></p><p class="text-xs text-muted">Chỉ hiển thị công đoạn do cán bộ cập nhật</p></div>
  <template v-if="latest.length"><ol class="space-y-3" aria-label="Các công đoạn đã được công bố">
   <li v-for="stage in latest" :key="stage.id" class="flex gap-3 rounded-xl border border-slate-200 p-3">
    <CheckCircle2 v-if="stage.stage_status==='done'" :size="19" class="mt-0.5 shrink-0 text-green-700"/>
    <AlertCircle v-else-if="stage.stage_status==='paused'" :size="19" class="mt-0.5 shrink-0 text-amber-700"/>
    <Clock3 v-else :size="19" class="mt-0.5 shrink-0 text-blue-700"/>
    <div class="min-w-0 flex-1"><div class="flex flex-wrap items-start justify-between gap-2"><b class="text-sm">{{stage.stage_name}}</b><span class="text-xs font-semibold text-brand-700">{{labels[stage.stage_status]}}</span></div>
     <p v-if="stage.unit_name" class="mt-1 text-xs text-muted">Đơn vị phụ trách: {{stage.unit_name}}</p>
     <p v-if="stage.due_at" class="mt-1 text-xs text-muted">Thời hạn do cán bộ cập nhật: {{dateTime(stage.due_at)}}</p>
     <p v-if="stage.reason" class="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">Lý do / thay đổi: {{stage.reason}}</p>
    </div>
   </li></ol>
   <details class="rounded-lg border border-slate-100 p-3"><summary class="cursor-pointer text-sm font-bold">Xem lịch sử cập nhật công đoạn ({{stages?.length||0}})</summary>
    <ol class="mt-2 space-y-2"><li v-for="stage in stages||[]" :key="`history-${stage.id}`" class="border-b py-2 text-xs last:border-0">{{dateTime(stage.created_at)}} · {{stage.stage_name}} — {{labels[stage.stage_status]}}<span v-if="stage.reason"> · {{stage.reason}}</span></li></ol>
   </details>
  </template>
  <div v-else class="rounded-lg bg-slate-50 p-3 text-sm text-slate-700" role="note">Chưa có thông tin công đoạn chi tiết được cán bộ công bố. Vui lòng xem lịch sử sự kiện bên dưới. Không suy đoán thời hạn hoặc đơn vị phụ trách.</div>
  <p v-if="status==='supplement'" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Hồ sơ đang chờ bạn hoàn thiện yêu cầu bổ sung.</p>
 </div>
</template>
