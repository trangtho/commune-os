<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {ArrowLeft,ArrowRight,CheckCircle2,FilePlus2,ShieldAlert} from 'lucide-vue-next'
type Item={procedure_id:string;title:string;category:string;application_id:string|null;status:string|null}
type Batch={id:string;title:string;purpose:string;workflow_mode:string;shared_consent:boolean;created_at:string;items:Item[]}
const route=useRoute();const id=String(route.params.id)
const {data:batch,error,refresh}=await useFetch<Batch>(`/api/service-batches/${encodeURIComponent(id)}`,{key:`citizen-batch:${id}`})
const created=computed(()=>batch.value?.items.filter(x=>x.application_id).length||0)
const submitted=computed(()=>batch.value?.items.filter(x=>x.status&&x.status!=='draft').length||0)
const completed=computed(()=>batch.value?.items.filter(x=>x.status==='completed').length||0)
const statuses:Record<string,string>={draft:'Đang chuẩn bị',submitted:'Đã nộp',processing:'Đang giải quyết',supplement:'Cần bổ sung',completed:'Đã hoàn thành',rejected:'Không được tiếp nhận'}
function href(i:Item){return i.application_id
 ? (i.status==='draft'?`/nop-ho-so/${i.procedure_id}?draft=${encodeURIComponent(i.application_id)}&bundle=${encodeURIComponent(id)}`:`/ho-so/${encodeURIComponent(i.application_id)}`)
 : `/nop-ho-so/${i.procedure_id}?bundle=${encodeURIComponent(id)}`}
</script>
<template>
 <div class="space-y-4"><NuxtLink to="/lien-thong" class="inline-flex items-center gap-1 text-sm font-bold text-brand-700"><ArrowLeft :size="16"/>Các nhóm hồ sơ</NuxtLink>
  <section v-if="error" role="alert" class="panel space-y-3 p-5 text-rose-700">Không tìm thấy nhóm hồ sơ thuộc tài khoản hoặc kết nối bị gián đoạn. <button class="btn-outline" @click="refresh()">Thử lại</button></section>
  <template v-else-if="batch">
   <div><h2 class="text-xl font-black">{{batch.title}}</h2><p v-if="batch.purpose" class="mt-1 text-sm text-muted">{{batch.purpose}}</p></div>
   <p class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ShieldAlert :size="17" class="mr-1 inline"/> Danh sách chuẩn bị chung, không phải thủ tục liên thông đã được phê duyệt. Từng hồ sơ cần tự kê khai, bổ sung giấy tờ và xác nhận nộp riêng.</p>
   <div class="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3"><div v-for="metric in [{label:'Đã tạo hồ sơ',value:created},{label:'Đã nộp',value:submitted},{label:'Hoàn thành',value:completed}]" :key="metric.label" class="panel p-3 text-center"><b class="block text-xl text-brand-800">{{metric.value}}/{{batch.items.length}}</b><span class="text-xs text-slate-600">{{metric.label}}</span></div></div>
   <section class="panel space-y-3 p-4 sm:p-5"><h3 class="font-extrabold">Các hồ sơ thành phần</h3><div v-for="(item,index) in batch.items" :key="item.procedure_id" class="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-800">{{index+1}}</span><span class="min-w-0 flex-1"><b class="block text-sm">{{item.title}}</b><small class="block text-slate-600">{{item.application_id||'Chưa tạo hồ sơ'}} · {{item.status?statuses[item.status]||item.status:'Chưa kê khai'}}</small></span><NuxtLink :to="href(item)" class="btn-outline text-xs"><CheckCircle2 v-if="item.status==='completed'" :size="16"/><FilePlus2 v-else :size="16"/>{{item.application_id?'Xem / tiếp tục':'Bắt đầu'}}<ArrowRight :size="14"/></NuxtLink></div></section>
   <p class="text-sm text-muted">{{batch.shared_consent?'Thông tin liên hệ đã đồng ý chia sẻ sẽ được đề xuất khi tạo hồ sơ mới.':'Bạn không lưu thông tin dùng chung; mỗi hồ sơ được kê khai riêng.'}} Trạng thái được lấy trực tiếp từ từng hồ sơ của bạn.</p>
   <button class="btn-outline" @click="refresh()">Cập nhật tiến độ</button>
  </template>
 </div>
</template>
