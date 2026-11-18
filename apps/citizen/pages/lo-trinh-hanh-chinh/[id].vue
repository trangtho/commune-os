<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Route,ArrowRight,CheckCircle2,RefreshCw} from 'lucide-vue-next'
definePageMeta({title:'Theo dõi lộ trình hành chính'})
const id=String(useRoute().params.id)
type Step={id:string;procedure_id:string;position:number;state:string;application_id:string|null;application_status:string|null;title:string;summary:string;fee_note:string;sla_days:number;documents:{code:string;name:string;required:boolean}[];source_url:string|null;provenance_status:string}
type Journey={title:string;situation:string;event_code:string;status:string;items:Step[];notice:string}
const {data:journey,error,refresh}=await useFetch<Journey>(`/api/citizen/journeys/${encodeURIComponent(id)}`,{key:`life-journey:${id}`})
const {data:cases}=await useFetch<{id:string;procedure_id:string;status:string}[]>('/api/applications',{key:'citizen-life-journey-owned-cases',default:()=>[]})
const linkSelection=reactive<Record<string,string>>({})
const saving=ref('');const notice=ref('');const errorText=ref('')
async function setState(item:Step,state:string){if(saving.value)return;saving.value=item.id;errorText.value='';notice.value=''
 try{await $fetch(`/api/citizen/journeys/${encodeURIComponent(id)}/items/${item.id}`,{method:'PATCH',body:{state}});await refresh();notice.value='Đã cập nhật tiến độ tự theo dõi.'}
 catch(e){errorText.value=readableError(e)}finally{saving.value=''}}
async function setJourney(status:string){if(saving.value)return;saving.value='journey';errorText.value=''
 try{await $fetch(`/api/citizen/journeys/${encodeURIComponent(id)}`,{method:'PATCH',body:{status}});await refresh()}
 catch(e){errorText.value=readableError(e)}finally{saving.value=''}}
async function linkCase(item:Step){const appId=linkSelection[item.id]
 if(!appId||saving.value)return
 saving.value=item.id;errorText.value=''
 try{await $fetch(`/api/citizen/journeys/${encodeURIComponent(id)}/items/${item.id}`,{method:'PATCH',
  body:{state:'in_progress',applicationId:appId}});await refresh();notice.value='Đã liên kết hồ sơ thuộc tài khoản.'}
 catch(e){errorText.value=readableError(e)}finally{saving.value=''}}
const doneCount=computed(()=>journey.value?.items.filter(i=>i.application_status==='completed'||(i.application_id===null&&i.state==='done')).length||0)
</script>
<template><div class="space-y-4"><NuxtLink to="/lo-trinh-hanh-chinh" class="text-sm font-semibold text-brand-700 underline">Lộ trình từ nhu cầu</NuxtLink>
 <section v-if="error" class="panel p-5 text-rose-700">Không thể mở lộ trình này. <button class="underline" @click="refresh()">Thử lại</button></section>
 <template v-else-if="journey"><section class="panel space-y-3 p-5"><div class="flex items-center gap-3"><Route class="text-brand-700"/><div><h2 class="text-xl font-black">{{journey.title}}</h2><p class="text-sm text-muted">{{journey.situation}}</p></div></div>
 <div class="flex flex-wrap items-center justify-between gap-3"><b class="text-brand-900">{{doneCount}} / {{journey.items.length}} bước đã hoàn thành</b><button type="button" class="btn-outline !text-xs" @click="refresh()"><RefreshCw :size="14"/>Làm mới tiến độ</button></div>
 <p class="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{{journey.notice}}</p><p v-if="notice" class="text-sm text-emerald-700" role="status">{{notice}}</p><p v-if="errorText" class="text-sm text-rose-700" role="alert">{{errorText}}</p></section>
 <section class="space-y-3"><article v-for="item in journey.items" :key="item.id" class="panel space-y-3 p-4"><div class="flex items-start gap-3"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-800">{{item.position}}</span><div class="min-w-0 flex-1"><h3 class="font-extrabold">{{item.title}}</h3><p class="mt-1 text-xs text-muted">{{item.summary}}</p><p class="mt-2 text-xs">{{item.application_id?'Hồ sơ đã liên kết: '+item.application_id:'Chưa tạo hồ sơ'}} · {{item.application_status||item.state}}</p></div></div>
 <details class="rounded-lg bg-slate-50 p-3 text-xs"><summary class="font-semibold">Giấy tờ và lưu ý chuẩn bị</summary><ul class="mt-2 list-disc pl-5"><li v-for="doc in item.documents" :key="doc.code">{{doc.name}}</li></ul><p class="mt-2">Lệ phí ghi trong danh mục: {{item.fee_note||'Chưa có'}} · Thời hạn: {{item.sla_days>0?`${item.sla_days} ngày (mẫu)`:'Chưa cập nhật'}}</p><p class="mt-1">Nguồn: {{item.provenance_status==='staff_declared'?'Đơn vị khai báo':'Chưa xác minh'}}</p></details>
 <div v-if="!item.application_id&&(cases||[]).some(c=>c.procedure_id===item.procedure_id)" class="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 p-3"><label class="text-xs font-semibold">Liên kết hồ sơ đã tạo<select v-model="linkSelection[item.id]" class="field mt-1"><option value="">Chọn hồ sơ cùng thủ tục</option><option v-for="c in (cases||[]).filter(c=>c.procedure_id===item.procedure_id)" :key="c.id" :value="c.id">{{c.id}} · {{c.status}}</option></select></label><button type="button" class="btn-outline !text-xs" :disabled="!linkSelection[item.id]||!!saving" @click="linkCase(item)">Liên kết hồ sơ</button></div>
 <div class="flex flex-wrap gap-2"><NuxtLink :to="item.application_id ? (item.application_status==='draft'?`/nop-ho-so/${item.procedure_id}?draft=${item.application_id}&step=1`:`/ho-so/${item.application_id}`) : `/thu-tuc/${item.procedure_id}`" class="btn-primary !text-xs">{{item.application_id?'Tiếp tục / theo dõi hồ sơ':'Xem và bắt đầu thủ tục'}} <ArrowRight :size="14"/></NuxtLink>
 <button v-if="journey.status==='active'&&!item.application_id" type="button" class="btn-outline !text-xs" :disabled="!!saving" @click="setState(item,item.state==='done'?'todo':'done')"><CheckCircle2 :size="14"/>{{item.state==='done'?'Bỏ đánh dấu tự theo dõi':'Đã chuẩn bị xong'}}</button></div></article></section>
 <div v-if="journey.status==='active'" class="flex flex-wrap gap-2"><button class="btn-outline" :disabled="!!saving" @click="setJourney('completed')">Đánh dấu đã kết thúc lộ trình</button><button class="btn-outline" :disabled="!!saving" @click="setJourney('archived')">Lưu trữ lộ trình</button></div>
 </template></div></template>
