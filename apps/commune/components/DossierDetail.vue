<script setup lang="ts">
import {FileText,Eye,Download,Check,Clock,AlertTriangle,History,MessageCircle,ArrowRight,ShieldCheck,Paperclip,RefreshCw} from 'lucide-vue-next'
import {statusNames,statusClass,fmtDate,procName,type Dossier,type Procedure} from '~/composables/useCommune'
const props=defineProps<{dossier:Dossier|null; role:string;procedures:Procedure[]}>()
const emit=defineEmits<{(e:'refresh'):void}>()
const {api,errText,config}=useCommune()
const tab=ref('documents'), busy=ref(false), reason=ref(''), error=ref(''),notice=ref('')
const stages=['Tiếp nhận','Thẩm định','Trình ký','Ký duyệt','Trả kết quả']
const stageIndex=computed(()=>{
 const s=props.dossier?.status
 return s==='submitted'?0:s==='received'?1:s==='in_review'||s==='need_supplement'?1:s==='pending_signature'?3:s==='approved'||s==='rejected'?4:s==='closed'?5:0
})
const isFinished=(i:number)=>i<stageIndex.value
const actions=computed(()=>{
 if(!props.dossier)return []
 const s=props.dossier.status, r=props.role
 if(r==='receptionist' && s==='submitted')return [{key:'accept',label:'Tiếp nhận hồ sơ'}]
 if(r==='officer' && s==='received')return [{key:'review',label:'Bắt đầu thẩm định'}]
 if(r==='officer' && s==='in_review')return [{key:'submit_for_signature',label:'Trình ký duyệt'},{key:'request_supplement',label:'Yêu cầu bổ sung'}]
 if(r==='leader' && s==='pending_signature')return [{key:'approve',label:'Phê duyệt'},{key:'reject',label:'Từ chối'}]
 if(r==='receptionist' && ['approved','rejected'].includes(s))return [{key:'close',label:'Xác nhận đã trả kết quả'}]
 if(r==='citizen' && s==='need_supplement')return [{key:'supplement',label:'Xác nhận đã bổ sung'}]
 return []
})
async function doAction(action:string){
 if(!props.dossier)return
 error.value='';notice.value=''
 if(['reject','request_supplement'].includes(action)&&reason.value.trim().length<5){error.value='Hãy nhập lý do ít nhất 5 ký tự';return}
 busy.value=true
 try {
   const url=`/api/dossiers/${props.dossier.id}/${action==='supplement'?'supplement':'transition'}`
   await api(url,{method:'POST',...(action==='supplement'?{}:{body:{action,reason:reason.value}})})
   notice.value='Đã cập nhật trạng thái hồ sơ';reason.value='';emit('refresh')
 }catch(e:any){error.value=errText(e)}finally{busy.value=false}
}
async function download(doc:any){
 if(!props.dossier)return
 try {
  const blob=await api<Blob>(`/api/dossiers/${props.dossier.id}/documents/${doc.id}/download`,{responseType:'blob'})
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=doc.filename;link.click();URL.revokeObjectURL(url)
 }catch(e:any){error.value=errText(e)}
}
const pendingDoc=ref<File|null>(null),pendingDocType=ref('')
async function attach(){
 if(!props.dossier||!pendingDoc.value||!pendingDocType.value)return
 busy.value=true;error.value=''
 try{const fd=new FormData();fd.append('doc_type',pendingDocType.value);fd.append('file',pendingDoc.value)
  await api(`/api/dossiers/${props.dossier.id}/documents`,{method:'POST',body:fd});pendingDoc.value=null;pendingDocType.value='';emit('refresh')
 }catch(e:any){error.value=errText(e)}finally{busy.value=false}
}
const currentProc=computed(()=>props.procedures.find(p=>p.code===props.dossier?.procedure_code))
</script>
<template>
 <div v-if="!dossier" class="empty-state"><FileText :size="44"/><h3>Chọn hồ sơ để xem chi tiết</h3><p>Tiến độ, giấy tờ, nhật ký và các thao tác nghiệp vụ xuất hiện tại đây.</p></div>
 <div v-else class="detail-root">
  <div class="card-head"><h3>Tiến trình hồ sơ: {{procName(dossier.procedure_code,procedures)}}</h3><span class="status-pill" :class="statusClass(dossier.status)">{{statusNames[dossier.status]}}</span></div>
  <div class="timeline"><div v-for="(stage,i) in stages" :key="stage" class="stage" :class="{finished:i<stageIndex,current:i===stageIndex}">
   <div class="stage-marker">{{isFinished(i)?'✓':i+1}}</div><div class="stage-name">{{i+1}}. {{stage}}</div></div></div>
  <div class="due-banner"><Clock :size="17"/><span>Hạn dự kiến (demo): <strong>{{fmtDate(dossier.due_at)}}</strong></span><span class="muted">{{dossier.code}}</span></div>
  <div class="tabs detail-tabs"><button v-for="t in [{id:'documents',name:'Thành phần hồ sơ'},{id:'information',name:'Thông tin hồ sơ'},{id:'history',name:'Lịch sử xử lý'},{id:'discuss',name:'Trao đổi'}]" :key="t.id" :class="{active:tab===t.id}" @click="tab=t.id">{{t.name}}</button></div>
  <div v-if="tab==='documents'" class="table-scroller"><table class="compact-table"><thead><tr><th>Giấy tờ</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>
    <tr v-for="req in currentProc?.required_documents||[]" :key="req.code"><td><span class="square-check">{{dossier.documents?.some(d=>d.doc_type===req.code)?'☑':'☐'}}</span>{{req.name}}</td>
      <td><span class="status-pill" :class="dossier.documents?.some(d=>d.doc_type===req.code)?'success':'warn'">{{dossier.documents?.some(d=>d.doc_type===req.code)?'Đã nộp':'Thiếu'}}</span></td>
      <td><button v-if="dossier.documents?.some(d=>d.doc_type===req.code)" class="tiny-icon" title="Tải về" @click="download(dossier.documents?.filter(d=>d.doc_type===req.code).at(-1))"><Download :size="17"/></button></td></tr>
  </tbody></table></div>
  <div v-else-if="tab==='information'" class="detail-info"><div><strong>Mã hồ sơ</strong><span>{{dossier.code}}</span></div><div><strong>Người nộp</strong><span>{{dossier.applicant}}</span></div><div><strong>Tiếp nhận</strong><span>{{fmtDate(dossier.received_at)}}</span></div><div><strong>Phiên bản thủ tục</strong><span>{{dossier.procedure_version}}</span></div><div v-for="(v,k) in dossier.form_data||{}" :key="k"><strong>{{k}}</strong><span>{{v}}</span></div></div>
  <div v-else-if="tab==='history'" class="event-list"><div v-for="event in dossier.events||[]" :key="event.id"><span class="event-dot"></span><strong>{{event.action}}</strong><small>{{fmtDate(event.at)}} · {{event.actor}}</small></div><p v-if="!dossier.events?.length" class="muted">Chưa có sự kiện.</p></div>
  <div v-else class="empty-mini"><MessageCircle :size="23"/> Mọi thay đổi nghiệp vụ được lưu trong mục Lịch sử xử lý. Nhắn tin hai chiều đang ở mức đặc tả.</div>
  <div v-if="['submitted','need_supplement'].includes(dossier.status) && ['citizen','receptionist','officer'].includes(role)" class="attachment-row">
    <select v-model="pendingDocType" aria-label="Loại tài liệu"><option value="">Chọn loại giấy tờ</option><option v-for="x in currentProc?.required_documents||[]" :value="x.code" :key="x.code">{{x.name}}</option></select>
    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" @change="pendingDoc=($event.target as HTMLInputElement).files?.[0]||null"/>
    <button class="btn subtle" :disabled="busy||!pendingDoc||!pendingDocType" @click="attach">Tải bổ sung</button>
  </div>
  <div v-if="actions.length" class="action-row"><input v-if="actions.some(a=>['reject','request_supplement'].includes(a.key))" v-model="reason" placeholder="Lý do bổ sung / từ chối (bắt buộc khi áp dụng)" aria-label="Lý do"/>
    <div class="action-buttons"><button v-for="a in actions" :key="a.key" class="btn" :class="['reject','request_supplement'].includes(a.key)?'danger-btn':'primary'" :disabled="busy" @click="doAction(a.key)">{{a.label}} <ArrowRight :size="15"/></button></div></div>
  <p v-if="notice" class="success-message">{{notice}}</p><p v-if="error" class="error-block">{{error}}</p>
  <p class="micro-disclaimer"><ShieldCheck :size="13"/> Không sử dụng thông tin này như quyết định hành chính hoặc chữ ký số pháp lý.</p>
 </div>
</template>
