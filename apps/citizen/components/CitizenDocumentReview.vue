<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {evaluateImageQuality} from '~/utils/document-quality'
const props=defineProps<{file:File;applicationId:string}>()
const emit=defineEmits<{(e:'confirm',value:Record<string,string>):void}>()
type Field={key:string;label:string;value:string;confidence:number}
const warnings=ref<string[]>([])
const size=ref('')
const ocrConsent=ref(false)
const ocrStatus=ref('')
const ocrBusy=ref(false)
const fields=ref<Field[]>([])
const confirmed=ref(false)
watch(()=>props.file,async file=>{
 warnings.value=[];size.value='';fields.value=[];ocrConsent.value=false;ocrStatus.value='';confirmed.value=false
 try{const r=await evaluateImageQuality(file);warnings.value=r.warnings;size.value=r.width?`${r.width} × ${r.height} px`:''}
 catch{warnings.value=['Không đọc được cấu trúc ảnh; bạn cần tự kiểm tra rõ chữ và đủ trang.']}
},{immediate:true})
async function runOcr(){
 if(!ocrConsent.value||ocrBusy.value)return
 ocrBusy.value=true;ocrStatus.value=''
 try{
  const data=new FormData();data.append('file',props.file);data.set('applicationId',props.applicationId);data.set('confirmed','true')
  const result=await $fetch<{status:string;fields:Field[];notice:string}>('/api/ai/document-review',{method:'POST',body:data})
  fields.value=result.fields||[];ocrStatus.value=result.notice
 }catch(error){ocrStatus.value=readableError(error)}finally{ocrBusy.value=false}
}
function confirm(){
 if(!confirmed.value||!fields.value.length)return
 emit('confirm',Object.fromEntries(fields.value.filter(x=>x.value.trim()).map(x=>[x.key,x.value.trim()])))
 ocrStatus.value='Đã ghi nhận lựa chọn. Dữ liệu OCR chỉ lưu để đối chiếu sau khi tệp được tải lên.'
}
</script>
<template>
 <section class="space-y-3 rounded-xl border border-amber-200 bg-white p-3" aria-label="Kiểm tra chất lượng và nhận dạng giấy tờ">
  <h4 class="text-sm font-extrabold">Kiểm tra chất lượng và gợi ý OCR</h4>
  <p class="text-xs text-muted">{{size?`Kích thước ảnh ${size}.`:''}} Công cụ kiểm tra ảnh tại máy, chỉ đưa ra cảnh báo, không xác nhận giấy tờ đủ trang hoặc hợp lệ.</p>
  <p v-if="!warnings.length" class="text-xs text-green-800">Chưa thấy dấu hiệu chất lượng thấp theo các quy tắc hiện có. Vẫn cần kiểm tra thủ công.</p>
  <ul v-else class="list-disc space-y-1 pl-5 text-xs text-amber-800"><li v-for="w in warnings" :key="w">{{w}}</li></ul>
  <label class="flex items-start gap-2 text-xs"><input v-model="ocrConsent" type="checkbox" class="mt-1"/><span>Tôi đồng ý gửi tệp này tới dịch vụ OCR được cấu hình để nhận gợi ý; thông tin có thể nhạy cảm và sẽ không tự điền.</span></label>
  <button type="button" class="btn-outline !text-xs" :disabled="!ocrConsent||ocrBusy" @click="runOcr">{{ocrBusy?'Đang phân tích...':'Trích xuất thông tin (OCR)'}}</button>
  <p v-if="ocrStatus" class="text-xs text-slate-700" role="status">{{ocrStatus}}</p>
  <div v-if="fields.length" class="space-y-2 border-t pt-3">
   <p class="text-xs font-bold">Gợi ý chưa xác minh — kiểm tra từng trường (độ tin cậy thấp được cảnh báo)</p>
   <label v-for="item in fields" :key="item.key" class="block text-xs"><span class="font-bold">{{item.label}} · {{Math.round(item.confidence*100)}}%</span><span v-if="item.confidence<.8" class="text-rose-700"> · Cần xem lại</span><input v-model="item.value" class="field mt-1" maxlength="200"/></label>
   <label class="flex items-start gap-2 text-xs"><input v-model="confirmed" type="checkbox" class="mt-1"/>Tôi đã đối chiếu gợi ý với giấy tờ và đồng ý lưu dữ liệu đã rà soát để cảnh báo sai lệch.</label>
   <button type="button" class="btn-outline !text-xs" :disabled="!confirmed" @click="confirm">Xác nhận dữ liệu đối chiếu</button>
  </div>
 </section>
</template>
