<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {GitBranch,RefreshCw,ArrowRight,AlertCircle} from 'lucide-vue-next'
const props=defineProps<{applicationId:string}>()
type Roadmap={status:string;explanation:{summary:string;latestNote:string|null;stage:string|null;unit:string|null;reason:string|null;notice:string};
 needsVersionAck:boolean;unresolvedSupplements:number;actions:{title:string;url:string;reason:string}[];events:{event_type:string;note:string;created_at:string}[];notice:string}
const {data,error,refresh,pending}=await useFetch<Roadmap>(()=>`/api/applications/${encodeURIComponent(props.applicationId)}/roadmap`,{key:`citizen-case-roadmap:${props.applicationId}`})
</script>
<template><section class="panel space-y-3 p-4" aria-label="Lộ trình tiếp theo của hồ sơ"><div class="flex items-center justify-between gap-2"><h3 class="flex items-center gap-2 font-extrabold"><GitBranch class="text-brand-700" :size="20"/>Điều phối bước tiếp theo</h3><button type="button" class="btn-outline !text-xs" :disabled="pending" @click="refresh()"><RefreshCw :size="14"/>Cập nhật</button></div>
 <p v-if="error" class="text-sm text-rose-700" role="alert">Chưa thể tải hướng dẫn từ hồ sơ.</p>
 <template v-else-if="data"><p class="rounded-lg bg-blue-50 p-3 text-sm font-semibold">{{data.explanation.summary}}</p>
 <p v-if="data.explanation.stage" class="text-sm">Công đoạn được ghi nhận: <b>{{data.explanation.stage}}</b><span v-if="data.explanation.unit"> · {{data.explanation.unit}}</span></p>
 <p v-if="data.explanation.latestNote" class="text-xs text-slate-700">Ghi chú mới nhất: {{data.explanation.latestNote}}</p><p v-if="data.explanation.reason" class="text-xs text-slate-700">Lý do do cán bộ ghi nhận: {{data.explanation.reason}}</p>
 <p v-if="data.needsVersionAck" class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle :size="15" class="mr-1 inline"/>Bản nháp chưa xác nhận phiên bản thủ tục đang áp dụng.</p>
 <p v-if="data.unresolvedSupplements" class="text-sm text-amber-800">Còn {{data.unresolvedSupplements}} yêu cầu bổ sung chưa được ghi nhận phản hồi.</p>
 <div class="grid gap-2 md:grid-cols-2"><NuxtLink v-for="a in data.actions" :key="a.url+a.title" :to="a.url" class="flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-white p-3 text-sm hover:bg-blue-50"><span><b class="text-brand-800">{{a.title}}</b><small class="mt-1 block text-muted">{{a.reason}}</small></span><ArrowRight :size="16"/></NuxtLink></div>
 <p class="text-xs text-muted">{{data.notice}}</p></template></section></template>
