<script setup lang="ts">
import {FilePlus2,FileCheck2,UploadCloud,AlertCircle,CheckCircle2,ShieldAlert} from 'lucide-vue-next'
import {type Procedure} from '~/composables/useCommune'
const props=defineProps<{procedures:Procedure[],role:string}>()
const emit=defineEmits<{(e:'created',id:string):void}>()
const {api,errText}=useCommune()
const procCode=ref(''),applicant=ref(''),fields=reactive<Record<string,string>>({}),uploads=reactive<Record<string,File|null>>({})
const checked=ref<any>(null),busy=ref(false),message=ref(''),error=ref('')
const selected=computed(()=>props.procedures.find(p=>p.code===procCode.value))
watch(selected,()=>{Object.keys(fields).forEach(k=>delete fields[k]);Object.keys(uploads).forEach(k=>delete uploads[k]);checked.value=null})
function chooseFile(event:Event,key:string){uploads[key]=(event.target as HTMLInputElement).files?.[0]||null;checked.value=null}
async function precheck(){
 if(!selected.value)return
 busy.value=true;error.value='';message.value=''
 try{checked.value=await api('/api/dossiers/precheck',{method:'POST',body:{procedure_code:procCode.value,
  document_types:Object.keys(uploads).filter(k=>uploads[k]),form_data:{...fields}}})
  if(checked.value.valid)message.value='Hồ sơ đủ thành phần tối thiểu để nộp thử nghiệm.'
 }catch(e:any){error.value=errText(e)}finally{busy.value=false}
}
async function submit(){
 if(!selected.value)return
 busy.value=true;error.value='';message.value=''
 try{
  const data=new FormData()
  data.append('data',JSON.stringify({procedure_code:procCode.value,applicant:applicant.value,form_data:{...fields}}))
  selected.value.required_documents.forEach(doc=>{const file=uploads[doc.code];if(file){data.append('files',file);data.append('doc_types',doc.code)}})
  const result:any=await api('/api/dossiers',{method:'POST',body:data})
  message.value='Đã tạo hồ sơ '+result.code;emit('created',result.id)
 }catch(e:any){error.value=errText(e)}finally{busy.value=false}
}
</script>
<template><div class="content-panel form-page">
 <div class="content-head"><div><span class="eyebrow">DỊCH VỤ MỘT CỬA</span><h2>{{role==='citizen'?'Nộp hồ sơ trực tuyến':'Tiếp nhận hồ sơ mới'}}</h2><p>Biểu mẫu được tạo từ gói thủ tục, kiểm tra giấy tờ trước khi tiếp nhận.</p></div><FilePlus2 :size="30" class="blue-text"/></div>
 <div class="notice-inline"><ShieldAlert :size="20"/><span>Chức năng hiện sử dụng dữ liệu giả lập. Không tải lên giấy tờ cá nhân thật. Hạn xử lý trong pack chỉ là ví dụ.</span></div>
 <div class="form-columns"><div class="form-fields">
 <label class="field-label">01 · Chọn thủ tục<select v-model="procCode"><option value="">— Chọn thủ tục —</option><option v-for="p in procedures" :key="p.code" :value="p.code">{{p.name}}</option></select></label>
 <template v-if="selected"><label class="field-label">02 · Họ và tên người nộp<input v-model="applicant" placeholder="Họ và tên (dữ liệu mẫu)"/></label>
  <label v-for="(field,key) in selected.form_schema?.properties||{}" :key="key" class="field-label">{{field.title||key}} <small v-if="selected.form_schema?.required?.includes(key)">(bắt buộc)</small><input v-model="fields[key]" :placeholder="'Nhập '+(field.title||key).toLowerCase()"/></label>
  <h3 class="block-title">03 · Giấy tờ đính kèm</h3><div v-for="doc in selected.required_documents" :key="doc.code" class="upload-item">
  <div class="upload-icon"><UploadCloud :size="19"/></div><div><strong>{{doc.name}}</strong><small>{{uploads[doc.code]?.name||'Chưa chọn · PDF/PNG/JPG/TXT, tối đa 5 MB'}}</small></div>
  <label class="btn subtle upload-button">Chọn tệp<input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" hidden @change="chooseFile($event,doc.code)"/></label></div>
  <div class="form-actions"><button class="btn subtle" :disabled="busy" @click="precheck">Kiểm tra hồ sơ</button><button class="btn primary" :disabled="busy" @click="submit">{{role==='citizen'?'Nộp hồ sơ':'Tiếp nhận hồ sơ'}} <FileCheck2 :size="17"/></button></div>
  <div v-if="checked&&!checked.valid" class="error-block"><AlertCircle :size="17"/> Thiếu giấy tờ: {{checked.missing_documents?.map((x:any)=>x.name).join(', ')||'Không'}}. Trường chưa hợp lệ: {{checked.invalid_fields?.join(', ')||'Không'}}.</div>
  <div v-if="message" class="success-message"><CheckCircle2 :size="17"/> {{message}}</div><p v-if="error" class="error-block">{{error}}</p>
 </template><div v-else class="empty-mini">Chọn một thủ tục để hiển thị biểu mẫu tương ứng.</div></div>
 <aside class="form-help"><h3>Quy trình xử lý tiêu chuẩn</h3><div v-for="(step,i) in ['Tiếp nhận & kiểm tra đầu vào','Chuyên viên thẩm định','Trình lãnh đạo phê duyệt','Trả kết quả và lưu kiểm toán']" :key="step" class="help-step"><span>{{i+1}}</span>{{step}}</div>
 <div class="help-small"><strong>Rào chắn Poka-yoke</strong><p>Nếu thiếu giấy tờ hoặc trường bắt buộc, API trả lỗi 422 và không khởi chạy hồ sơ chính thức.</p></div>
 <div class="help-small"><strong>Thời hạn minh họa</strong><p>{{selected?selected.sla_hours+' giờ theo pack '+selected.version:'Chọn thủ tục để xem cấu hình'}}. Cần kiểm tra pháp lý trước sử dụng thực tế.</p></div></aside></div>
</div></template>
