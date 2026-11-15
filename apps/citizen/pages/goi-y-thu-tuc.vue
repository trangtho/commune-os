<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import { ArrowLeft,ArrowRight,CheckCircle2,ClipboardList,RefreshCcw,ShieldAlert } from 'lucide-vue-next'
import { purposes,audiences,localityModes,situations } from '~/shared/procedure-wizard.mjs'
type Match = {id:string;title:string;category:string;summary:string;verified:boolean;explanation:string;distinction:string;notice:string;sourceReference:string}
type Result = {items:Match[];localityNotice:string;advisory:boolean}
const questions=[
 {title:'Bạn muốn giải quyết việc gì?',help:'Chọn nội dung gần nhất với nhu cầu của bạn.',key:'purpose',options:purposes},
 {title:'Thủ tục liên quan đến ai?',help:'Thông tin này giúp ưu tiên thủ tục phù hợp để tham khảo.',key:'audience',options:audiences},
 {title:'Bạn muốn thực hiện ở đâu?',help:'Địa phương tiếp nhận chính thức sẽ được xác minh tại bước nộp hồ sơ.',key:'locality',options:localityModes},
 {title:'Tình huống thực tế của bạn?',help:'Kết quả là gợi ý, không thay thế việc kiểm tra điều kiện pháp lý.',key:'situation',options:situations}
] as const
const answers=reactive({purpose:'',audience:'',locality:'',situation:''})
const stage=ref(0)
const busy=ref(false)
const message=ref('')
const result=ref<Result|null>(null)
const current=computed(()=>questions[stage.value])
function restart(){stage.value=0;result.value=null;message.value='';answers.purpose='';answers.audience='';answers.locality='';answers.situation=''}
async function next(){
 if(!answers[current.value.key]){message.value='Vui lòng chọn một câu trả lời trước khi tiếp tục.';return}
 message.value=''
 if(stage.value<questions.length-1){stage.value++;return}
 busy.value=true
 try{result.value=await $fetch<Result>('/api/procedures/match',{method:'POST',body:answers})}
 catch{message.value='Không thể tra cứu lúc này. Vui lòng thử lại hoặc mở danh mục thủ tục.'}
 finally{busy.value=false}
}
</script>
<template>
 <div class="mx-auto max-w-4xl space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-2">
   <div><h2 class="text-xl font-black text-slate-900">Tìm thủ tục qua câu hỏi</h2>
    <p class="mt-1 text-sm text-muted">Không cần biết tên thủ tục. Trả lời 4 câu hỏi để tìm mục phù hợp trong danh mục CommuneOS.</p></div>
   <NuxtLink to="/thu-tuc" class="btn-outline text-sm"><ClipboardList :size="16"/>Tất cả thủ tục</NuxtLink>
  </div>
  <section class="panel space-y-5 p-4 sm:p-6" aria-label="Bộ câu hỏi xác định thủ tục">
   <div class="flex items-center justify-between text-xs font-bold text-brand-700">
    <span>{{result?'Đã hoàn thành':'Câu hỏi '+(stage+1)+' / '+questions.length}}</span>
    <button type="button" class="inline-flex items-center gap-1 underline" @click="restart"><RefreshCcw :size="14"/>Làm lại</button>
   </div>
   <div class="h-2 overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-brand-600 transition-all" :style="{width:(result?100:((stage+1)/questions.length)*100)+'%'}"/></div>
   <template v-if="!result">
    <div><h3 class="text-lg font-extrabold">{{current.title}}</h3><p class="mt-1 text-sm text-slate-600">{{current.help}}</p></div>
    <fieldset class="grid gap-3 sm:grid-cols-2">
     <legend class="sr-only">{{current.title}}</legend>
     <label v-for="option in current.options" :key="option.value"
      :class="['flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 p-3 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-brand-500',answers[current.key]===option.value?'border-brand-600 bg-brand-50 text-brand-900':'border-slate-200 bg-white hover:border-brand-300']">
      <input v-model="answers[current.key]" type="radio" :name="current.key" :value="option.value" class="h-4 w-4 accent-blue-700"/>
      <span class="flex-1">{{option.label}}</span><CheckCircle2 v-if="answers[current.key]===option.value" :size="18" class="text-brand-600"/>
     </label>
    </fieldset>
    <p v-if="message" class="text-sm text-rose-700" role="alert">{{message}}</p>
    <div class="flex flex-wrap justify-between gap-2 border-t pt-4">
     <button class="btn-outline" type="button" :disabled="stage===0" @click="stage--;message='' "><ArrowLeft :size="16"/>Quay lại</button>
     <button class="btn-primary" type="button" :disabled="busy" @click="next">{{stage===questions.length-1?'Xem kết quả gợi ý':'Tiếp tục'}}<ArrowRight :size="16"/></button>
    </div>
   </template>
   <template v-else>
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status"><ShieldAlert class="mb-1 inline" :size="18"/> Kết quả chỉ nhằm định hướng tìm kiếm. Hiện chưa có bộ quy tắc nghiệp vụ chính thức được xác minh cho các thủ tục mẫu. Cần kiểm tra điều kiện và cơ quan tiếp nhận trước khi nộp.</div>
    <p class="text-sm text-slate-600">{{result.localityNotice}}</p>
    <h3 class="text-lg font-bold">Thủ tục có thể phù hợp ({{result.items.length}})</h3>
    <div v-if="!result.items.length" class="rounded-xl bg-slate-50 p-4 text-sm">Chưa đủ căn cứ để xác định thủ tục. Bạn có thể tra cứu toàn bộ danh mục hoặc hỏi bộ phận hỗ trợ.</div>
    <article v-for="item in result.items" :key="item.id" class="space-y-3 rounded-xl border p-4">
     <div class="flex flex-wrap items-center gap-2"><h4 class="font-extrabold text-brand-900">{{item.title}}</h4><span class="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{{item.category}}</span></div>
     <p class="text-sm">{{item.explanation}}</p><p class="text-sm text-slate-600"><b>Phân biệt:</b> {{item.distinction}}</p>
     <p class="text-xs text-amber-700">{{item.notice}}</p>
     <p v-if="item.verified && item.sourceReference" class="text-xs text-slate-600"><b>Nguồn quy tắc đã xác minh:</b> {{item.sourceReference}}</p>
     <div class="flex flex-wrap gap-2"><NuxtLink :to="`/thu-tuc/${item.id}`" class="btn-primary text-sm">Xem chi tiết<ArrowRight :size="16"/></NuxtLink><NuxtLink :to="`/nop-ho-so/${item.id}`" class="btn-outline text-sm">Bắt đầu kê khai</NuxtLink></div>
    </article>
    <div class="flex flex-wrap gap-3 border-t pt-4"><button type="button" class="btn-outline" @click="restart">Trả lời lại</button><NuxtLink to="/thu-tuc" class="text-sm font-bold text-brand-700 underline">Xem toàn bộ danh mục</NuxtLink></div>
   </template>
  </section>
 </div>
</template>
