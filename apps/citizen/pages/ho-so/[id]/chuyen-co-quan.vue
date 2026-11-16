<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ArrowLeft,Building2,Route,Send,ShieldAlert} from 'lucide-vue-next'
const id=String(useRoute().params.id)
const {dateTime}=useFormat()
interface Candidate {tenant_id:string;tenant_name:string;approval_reference:string;valid_until:string}
interface Transfer {id:string;destination_name:string;status:string;decision_note:string;created_at:string}
interface Routing {currentTenantId:string;currentTenantName:string;candidates:Candidate[];transfers:Transfer[];applicationStatus:string;suggestedTenantId:string|null;verifiedLocality:boolean;notice:string}
const {data,error,refresh}=await useFetch<Routing>(`/api/applications/${encodeURIComponent(id)}/routing`)
const destination=ref('');const reason=ref('');const busy=ref(false);const note=ref('');const problem=ref('')
watch(data,value=>{if(value?.suggestedTenantId&&!destination.value)destination.value=value.suggestedTenantId},{immediate:true})
const canRequest=computed(()=>Boolean(data.value&&['submitted','processing','supplement'].includes(data.value.applicationStatus)))
async function askTransfer(){if(busy.value||!destination.value||reason.value.trim().length<10)return
 busy.value=true;note.value='';problem.value=''
 try{await $fetch(`/api/applications/${encodeURIComponent(id)}/requests`,{method:'POST',body:{kind:'transfer',destinationTenantId:destination.value,reason:reason.value.trim()}})
 note.value='Đã gửi đề nghị. Chỉ cán bộ có thẩm quyền có thể khởi tạo chuyển giao; đơn vị nhận phải xác nhận tiếp nhận.'
 reason.value='';await refresh()}catch(e){problem.value=readableError(e)}finally{busy.value=false}
}
</script>
<template>
 <div class="space-y-4">
  <NuxtLink :to="`/ho-so/${encodeURIComponent(id)}`" class="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft :size="16"/>Về hồ sơ</NuxtLink>
  <div><h2 class="text-xl font-black">Gợi ý cơ quan và đề nghị chuyển hồ sơ</h2><p class="text-sm text-muted">Hồ sơ {{id}}</p></div>
  <section v-if="error" class="panel p-5 text-rose-700" role="alert">Chưa tải được thông tin thẩm quyền. <button class="underline" @click="refresh()">Thử lại</button></section>
  <template v-else-if="data">
   <section class="panel space-y-3 p-5"><h3 class="section-label"><Building2 :size="18"/>Đơn vị đang tiếp nhận</h3><p class="font-bold">{{data.currentTenantName}}</p>
    <p class="text-sm text-muted">{{data.notice}}</p><p v-if="!data.verifiedLocality" class="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert :size="18" class="shrink-0"/>Địa phương cư trú chưa được xác minh bởi nguồn định danh đáng tin cậy. Không dùng dữ liệu tự khai để kết luận thẩm quyền.</p>
   </section>
   <section class="panel space-y-4 p-5"><h3 class="section-label"><Route :size="18"/>Tuyến tiếp nhận đã được công bố</h3>
    <p v-if="!data.candidates.length" class="text-sm text-muted">Chưa có tuyến chuyển đến cơ quan khác được phê duyệt cho thủ tục này. Vui lòng liên hệ cơ quan tiếp nhận.</p>
    <form v-else-if="canRequest" class="space-y-3" @submit.prevent="askTransfer">
     <label for="route-target" class="field-label">Đơn vị đề nghị chuyển đến</label>
     <select id="route-target" v-model="destination" class="field" required><option disabled value="">Chọn đơn vị</option><option v-for="r in data.candidates" :key="r.tenant_id" :value="r.tenant_id">{{r.tenant_name}}</option></select>
     <p v-if="destination" class="text-xs text-muted">Căn cứ: {{data.candidates.find(c=>c.tenant_id===destination)?.approval_reference}}. Cơ quan vẫn phải kiểm tra hồ sơ và xác nhận chuyển giao.</p>
     <label for="route-reason" class="field-label">Lý do đề nghị chuyển cơ quan</label>
     <textarea id="route-reason" v-model="reason" class="field" rows="4" minlength="10" maxlength="2000" required placeholder="Nêu địa bàn, tình huống và lý do cần chuyển cơ quan..."/>
     <button type="submit" class="btn-primary" :disabled="busy||!destination||reason.trim().length<10"><Send :size="16"/>{{busy?'Đang gửi...':'Gửi đề nghị chuyển cơ quan'}}</button>
    </form>
    <p v-else class="text-sm text-muted">Trạng thái hồ sơ hiện tại không cho phép gửi đề nghị chuyển cơ quan.</p>
   </section>
   <section class="panel space-y-3 p-5"><h3 class="section-label">Lịch sử chuyển giao chính thức</h3>
    <p v-if="!data.transfers.length" class="text-sm text-muted">Chưa có lần chuyển giao nào được cán bộ khởi tạo.</p>
    <div v-for="t in data.transfers" :key="t.id" class="rounded-lg border border-slate-200 p-3 text-sm"><p><b>{{t.destination_name}}</b> · {{t.status==='pending'?'Đang chờ tiếp nhận':t.status==='received'?'Đã tiếp nhận':'Không tiếp nhận'}}</p><p class="mt-1 text-xs text-muted">{{dateTime(t.created_at)}}</p><p v-if="t.decision_note" class="mt-2 whitespace-pre-wrap">{{t.decision_note}}</p></div>
   </section>
  </template>
  <p v-if="note" class="rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">{{note}}</p><p v-if="problem" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">{{problem}}</p>
 </div>
</template>
