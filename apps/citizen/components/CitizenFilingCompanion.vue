<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script setup lang="ts">
import {Bot,ClipboardCheck,AlertCircle,FilePlus2,ShieldCheck,MessageCircleQuestion} from 'lucide-vue-next'
const props=defineProps<{procedureId:string;applicationId:string;currentStep:number;actingFor?:string}>()
const emit=defineEmits<{(e:'apply',fields:Record<string,string>):void}>()
type Packet={suggestions:{fieldKey:string;label:string;value:string;sourceLabel:string;source:string}[];missingFields:{key:string;label:string}[];
 missingDocuments:{document_code:string;document_name:string}[];vault:{id:string;title:string;version_id:string;original_name:string}[];notice:string}
const {data:guide}=await useFetch<{fields:{key:string;label:string;description:string;source:string|null;required:boolean}[];notice:string}>(()=>`/api/procedures/${encodeURIComponent(props.procedureId)}/guide`,{key:`companion-guide:${props.procedureId}`})
const selectedField=ref('');const packet=ref<Packet|null>(null);const selected=ref<string[]>([]);const consent=ref(false)
const saving=ref(false);const busy=ref(false);const errorText=ref('');const message=ref('')
const metricsConsent=ref(false);const metricsType=ref('unclear_field')
const currentGuide=computed(()=>guide.value?.fields.find(f=>f.key===selectedField.value))
async function preview(){if(!props.applicationId||!consent.value||busy.value||props.actingFor==='representative')return
 busy.value=true;errorText.value='';packet.value=null
 try{packet.value=await $fetch(`/api/applications/${encodeURIComponent(props.applicationId)}/packet-preview`)}catch(e){errorText.value=readableError(e)}finally{busy.value=false}}
function apply(){if(!packet.value||!selected.value.length||!consent.value)return
 const chosen=Object.fromEntries(packet.value.suggestions.filter(s=>selected.value.includes(s.fieldKey)).map(s=>[s.fieldKey,s.value]))
 emit('apply',chosen);message.value='Gợi ý đã được chuyển vào biểu mẫu. Hãy rà soát lại và lưu bản nháp để ghi nhận.';selected.value=[];packet.value=null;consent.value=false}
async function feedback(){if(!metricsConsent.value||saving.value)return
 saving.value=true;errorText.value=''
 try{await $fetch('/api/citizen/feedback-signals',{method:'POST',body:{procedureId:props.procedureId,stage:props.currentStep===1?'form':props.currentStep===2?'documents':'review',issue:metricsType.value,consent:true}});message.value='Đã ghi nhận phản hồi tổng hợp, không lưu dữ liệu biểu mẫu.';metricsConsent.value=false}
 catch(e){errorText.value=readableError(e)}finally{saving.value=false}}
</script>
<template><section class="space-y-3 rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50 to-white p-4" aria-label="Trợ lý đồng hành kê khai"><div class="flex items-center gap-2"><Bot class="text-brand-700" :size="22"/><h3 class="font-extrabold text-brand-900">Trợ lý đồng hành kê khai</h3></div>
 <p class="text-xs text-muted">Đang ở bước {{currentStep}}/3. Trợ lý đọc cấu trúc biểu mẫu hiện có, không tự sửa, tự nộp hoặc kết luận tính hợp pháp của hồ sơ.</p>
 <div v-if="guide?.fields?.length" class="space-y-2"><label class="block text-xs font-semibold">Chọn trường cần giải thích<select v-model="selectedField" class="field mt-1"><option value="">Chọn một trường...</option><option v-for="field in guide.fields" :key="field.key" :value="field.key">{{field.label}}</option></select></label><div v-if="currentGuide" class="rounded-lg border border-blue-100 bg-white p-3 text-xs"><b>{{currentGuide.label}}{{currentGuide.required?' · Bắt buộc theo biểu mẫu':''}}</b><p class="mt-1 leading-relaxed">{{currentGuide.description}}</p><p v-if="currentGuide.source" class="mt-1 text-brand-700">Nguồn trong danh mục: {{currentGuide.source}}</p></div></div>
 <div v-if="applicationId&&actingFor!=='representative'" class="space-y-2 border-t border-blue-100 pt-3"><h4 class="flex items-center gap-2 text-sm font-extrabold"><FilePlus2 :size="16"/>Tạo gợi ý bộ hồ sơ từ dữ liệu đã lưu</h4>
 <label class="flex items-start gap-2 text-xs"><input v-model="consent" type="checkbox" class="mt-1 accent-blue-700"/>Tôi cho phép đọc thông tin hồ sơ cá nhân, kho giấy tờ và bản nháp của mình để xem trước gợi ý. Không chia sẻ tài liệu nếu chưa xác nhận riêng.</label>
 <button class="btn-outline !text-xs" type="button" :disabled="!consent||busy" @click="preview">{{busy?'Đang đối chiếu...':'Xem trước nội dung có thể sử dụng lại'}}</button>
 <div v-if="packet" class="space-y-2 rounded-lg bg-white p-3 text-xs"><p class="font-bold">Trường có thể gợi ý ({{packet.suggestions.length}})</p><p v-if="!packet.suggestions.length" class="text-muted">Không có trường mới phù hợp từ dữ liệu được phép sử dụng.</p><label v-for="s in packet.suggestions" :key="s.fieldKey" class="flex items-start gap-2 rounded-lg border p-2"><input v-model="selected" :value="s.fieldKey" type="checkbox" class="mt-1 accent-blue-700"/><span><b>{{s.label}}</b><span class="block break-all">{{s.value}}</span><small class="text-muted">{{s.sourceLabel}}</small></span></label><button v-if="selected.length" class="btn-primary !text-xs" type="button" @click="apply"><ClipboardCheck :size="14"/>Áp dụng {{selected.length}} trường để kiểm tra lại</button>
 <p class="mt-2 font-bold">Giấy tờ còn thiếu: {{packet.missingDocuments.length}}</p><ul class="list-disc pl-5"><li v-for="d in packet.missingDocuments" :key="d.document_code">{{d.document_name}}</li></ul>
 <p>Kho giấy tờ của bạn: {{packet.vault.length}} mục. Chọn “Dùng giấy tờ từ kho” tại bước tải tệp để xác nhận chia sẻ cho từng hồ sơ.</p><p class="text-muted">{{packet.notice}}</p></div></div>
 <div class="space-y-2 border-t border-blue-100 pt-3"><h4 class="flex items-center gap-2 text-sm font-bold"><MessageCircleQuestion :size="16"/>Phản ánh điểm chưa rõ (tùy chọn)</h4><select v-model="metricsType" class="field text-xs"><option value="unclear_field">Trường kê khai chưa rõ</option><option value="needs_help">Cần thêm hướng dẫn</option><option value="validation_problem">Khó hiểu lỗi kiểm tra</option></select><label class="flex items-start gap-2 text-xs"><input v-model="metricsConsent" type="checkbox" class="mt-1"/>Tôi đồng ý gửi thống kê ẩn danh về loại khó khăn, không gửi tên, nội dung câu hỏi hay giá trị các trường.</label><button type="button" class="btn-outline !text-xs" :disabled="!metricsConsent||saving" @click="feedback">Gửi phản ánh tổng hợp</button></div>
 <p v-if="errorText" class="text-xs text-rose-700" role="alert"><AlertCircle :size="14" class="inline"/>{{errorText}}</p><p v-if="message" class="text-xs text-emerald-700" role="status"><ShieldCheck :size="14" class="inline"/>{{message}}</p></section></template>
