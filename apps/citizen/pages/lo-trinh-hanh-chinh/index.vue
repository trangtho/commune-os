<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Route,Search,ArrowRight,Save,AlertTriangle,CheckCircle2,Info,Scale} from 'lucide-vue-next'
definePageMeta({title:'Lộ trình từ nhu cầu thực tế'})
type Step={id:string;title:string;summary:string;position:number;documents:{code:string;name:string;required:boolean}[];fee:string|null;durationDays:number|null;source:string;legalSource:string|null;provenance:string;dependency:string;canParallel:null}
type Response={event:string;items:Step[];questions:{key:string;label:string;choices:string[]}[];notice:string;disclosure:string}
const {data:auth}=await useFetch<{authenticated:boolean}>('/api/auth/me',{key:'life-journey-auth'})
const situation=ref('');const answers=reactive<Record<string,string>>({});const result=ref<Response|null>(null)
const loading=ref(false);const saving=ref(false);const errorText=ref('');const selected=ref<string[]>([])
const title=ref('');const channelFor=ref('')
const channelDetails=ref<{ways:{code:string;title:string;why:string;visits:null}[];feeNote:string;notice:string}|null>(null)
const canSave=computed(()=>Boolean(auth.value?.authenticated&&selected.value.length&&title.value.trim().length>=3))
async function analyze(){if(loading.value||situation.value.trim().length<5)return
 loading.value=true;errorText.value='';result.value=null;channelDetails.value=null
 try{const data=await $fetch<Response>('/api/journeys/analyze',{method:'POST',body:{situation:situation.value.trim(),
  ...(answers.representation?{representation:answers.representation}:{}),...(answers.locality?{locality:answers.locality}:{}),...(answers.channel?{channel:answers.channel}:{})}})
  result.value=data;selected.value=data.items.map(x=>x.id);title.value=situation.value.trim().slice(0,100)
 }catch(error){errorText.value=readableError(error)}finally{loading.value=false}}
function toggle(id:string){selected.value=selected.value.includes(id)?selected.value.filter(x=>x!==id):selected.value.length<6?[...selected.value,id]:selected.value}
async function save(){if(!canSave.value||saving.value)return
 saving.value=true;errorText.value=''
 try{const created=await $fetch<{id:string}>('/api/citizen/journeys',{method:'POST',body:{title:title.value.trim(),situation:situation.value.trim(),eventCode:result.value?.event||'other',procedureIds:selected.value}})
 await navigateTo(`/lo-trinh-hanh-chinh/${created.id}`)
 }catch(error){errorText.value=readableError(error)}finally{saving.value=false}}
async function compare(id:string){channelFor.value=id;channelDetails.value=null
 try{channelDetails.value=await $fetch(`/api/procedures/${encodeURIComponent(id)}/channels`)}catch(error){errorText.value=readableError(error)}}
</script>
<template><div class="space-y-4">
 <section class="panel space-y-4 p-5"><div class="flex items-center gap-3"><Route class="text-brand-700" :size="28"/><div><h2 class="text-xl font-black">Từ nhu cầu đời sống đến lộ trình hành chính</h2><p class="text-sm text-muted">Mô tả bằng ngôn ngữ thường dùng. Hệ thống chỉ gợi ý thủ tục có trong danh mục được công bố.</p></div></div>
 <form class="space-y-3" @submit.prevent="analyze"><label class="field-label" for="real-life-situation">Bạn đang cần giải quyết điều gì?</label>
 <textarea id="real-life-situation" v-model="situation" class="field" rows="3" maxlength="500" minlength="5" required placeholder="Ví dụ: Tôi vừa sinh con, muốn chuẩn bị các giấy tờ cho con..."/>
 <div class="flex flex-wrap gap-2"><button v-for="demo in ['Tôi vừa sinh con, muốn làm giấy tờ cho con','Tôi vừa chuyển đến nơi ở mới','Tôi chuẩn bị mở cửa hàng']" :key="demo" class="btn-outline !text-xs" type="button" @click="situation=demo">{{demo}}</button></div>
 <button class="btn-primary" type="submit" :disabled="loading||situation.trim().length<5"><Search :size="16"/>{{loading?'Đang đối chiếu danh mục...':'Phân tích nhu cầu'}}</button></form>
 <p v-if="errorText" class="rounded-lg bg-rose-50 p-3 text-sm text-rose-700" role="alert">{{errorText}}</p></section>
 <template v-if="result"><section class="panel space-y-3 p-5"><h3 class="font-extrabold">Làm rõ hoàn cảnh thực hiện</h3><p class="text-xs text-muted">Chọn thông tin tự nguyện cung cấp; sau đó phân tích lại để hoàn thiện ngữ cảnh. Không yêu cầu số định danh.</p>
 <div class="grid gap-3 md:grid-cols-3"><label v-for="q in result.questions" :key="q.key" class="text-sm font-semibold">{{q.label}}<select v-model="answers[q.key]" class="field mt-1"><option value="">Chưa chọn</option><option v-for="c in q.choices" :key="c" :value="c">{{c}}</option></select></label></div>
 <button type="button" class="btn-outline !text-xs" @click="analyze">Cập nhật gợi ý theo câu trả lời</button></section>
 <section class="panel space-y-3 p-5"><div class="flex flex-wrap items-center justify-between gap-2"><h3 class="text-lg font-extrabold">Các thủ tục có thể liên quan ({{result.items.length}})</h3><span class="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">Chỉ là gợi ý</span></div>
 <p class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle :size="16" class="mr-1 inline"/>{{result.notice}}</p>
 <p v-if="!result.items.length" class="text-sm text-muted">Chưa tìm được thủ tục tương ứng. Hãy mô tả cụ thể hơn hoặc liên hệ đơn vị có thẩm quyền.</p>
 <div v-for="item in result.items" :key="item.id" class="rounded-xl border border-slate-200 p-4"><div class="flex items-start gap-3"><label class="flex flex-1 items-start gap-2"><input type="checkbox" :checked="selected.includes(item.id)" class="mt-1 accent-blue-700" @change="toggle(item.id)"/><span><b class="text-brand-800">{{item.title}}</b><small class="mt-1 block text-slate-600">{{item.summary}}</small></span></label><NuxtLink :to="item.source" class="text-sm font-bold text-brand-700 underline">Chi tiết</NuxtLink></div>
 <div class="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2"><p>Thời hạn hệ thống: {{item.durationDays===null?'Chưa rõ':item.durationDays+' ngày (mẫu)'}}</p><p>Lệ phí: {{item.fee||'Chưa rõ'}}</p></div>
 <details class="mt-3 rounded-lg bg-slate-50 p-3 text-xs"><summary class="cursor-pointer font-semibold">Giấy tờ đã liệt kê ({{item.documents.length}})</summary><p v-if="!item.documents.length" class="mt-2">Chưa có danh sách giấy tờ.</p><ul class="mt-2 list-disc space-y-1 pl-5"><li v-for="d in item.documents" :key="d.code">{{d.name}}{{d.required?' · Theo danh mục bắt buộc':''}}</li></ul></details>
 <p class="mt-2 text-xs text-slate-600"><Scale :size="13" class="mr-1 inline"/>Nguồn pháp lý: {{item.provenance==='staff_declared'?'Đơn vị khai báo (chưa xác thực độc lập)':'Dữ liệu mẫu/chưa xác minh'}}. <a v-if="item.legalSource" :href="item.legalSource" target="_blank" rel="noopener noreferrer" class="font-semibold text-brand-700 underline">Mở nguồn đã khai báo</a></p>
 <button type="button" class="mt-2 text-xs font-semibold text-brand-700 underline" @click="compare(item.id)">So sánh phương thức thực hiện</button>
 <div v-if="channelFor===item.id&&channelDetails" class="mt-3 rounded-lg bg-blue-50 p-3 text-sm"><p class="font-bold">Các phương thức có tín hiệu trong hệ thống</p><p v-if="!channelDetails.ways.length" class="mt-1">Chưa tìm thấy tuyến tiếp nhận được mở. Vui lòng xác minh với cơ quan.</p><ul class="mt-2 space-y-2"><li v-for="way in channelDetails.ways" :key="way.code"><b>{{way.title}}</b> — {{way.why}}</li></ul><p class="mt-2 text-xs">{{channelDetails.notice}}</p></div></div>
 </section><section class="panel space-y-3 p-5"><h3 class="flex items-center gap-2 font-extrabold"><Save :size="20"/>Lưu lộ trình theo dõi</h3>
 <label class="block text-sm font-semibold">Tên lộ trình<input v-model="title" class="field mt-1" maxlength="120" minlength="3" placeholder="Ví dụ: Giấy tờ cho con"/></label>
 <p class="text-xs text-muted">Từng thủ tục chỉ được mở khi bạn chủ động chọn. Chưa thể khẳng định thủ tục nào phải làm trước hoặc có thể làm song song.</p>
 <p v-if="!auth?.authenticated" class="text-sm"><NuxtLink to="/dang-nhap" class="font-bold text-brand-700 underline">Đăng nhập</NuxtLink> để lưu và theo dõi lộ trình trên các thiết bị.</p>
 <button v-else type="button" class="btn-primary" :disabled="saving||!canSave" @click="save"><CheckCircle2 :size="16"/>{{saving?'Đang lưu...':`Lưu ${selected.length} thủ tục đã chọn`}}</button></section></template>
 <NuxtLink to="/khong-gian-ca-nhan" class="inline-flex items-center gap-2 text-sm font-bold text-brand-700">Mở không gian hành chính cá nhân <ArrowRight :size="16"/></NuxtLink>
 </div></template>
