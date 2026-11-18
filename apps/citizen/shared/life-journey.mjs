// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {normalizePhrase,matchSituation,nextCaseActions} from './citizen-intelligence.mjs'

export const lifeEvents=Object.freeze([
 {code:'birth',name:'Sinh con',hints:['sinh con','khai sinh','em be','moi sinh']},
 {code:'marriage',name:'Kết hôn',hints:['ket hon','cuoi','lap gia dinh']},
 {code:'residence',name:'Thay đổi nơi cư trú',hints:['chuyen nha','chuyen cho o','cu tru','tam tru','thuong tru','chuyen den']},
 {code:'business',name:'Mở hoạt động kinh doanh',hints:['mo cua hang','kinh doanh','mo quan','ban hang']},
 {code:'loss',name:'Gia đình có người mất',hints:['qua doi','mat nguoi than','khai tu']}
])
export function detectLifeEvent(text){
 const query=normalizePhrase(text)
 return lifeEvents.find(x=>x.hints.some(h=>query.includes(normalizePhrase(h))))?.code||'other'
}
export function clarificationQuestions(input){
 const questions=[]
 if(!input.representation) questions.push({key:'representation',label:'Bạn thực hiện cho ai?',choices:['Bản thân','Con','Người thân được ủy quyền']})
 if(!input.locality) questions.push({key:'locality',label:'Bạn định thực hiện ở đâu?',choices:['Nơi cư trú','Nơi tạm trú','Địa phương khác']})
 if(!input.channel) questions.push({key:'channel',label:'Bạn muốn thực hiện theo cách nào?',choices:['Trực tuyến','Tại bộ phận một cửa','Cần hỗ trợ']})
 return questions
}
export function buildLifeJourney(situation,catalog,options={}){
 const event=detectLifeEvent(situation)
 // Matching is strictly constrained to procedures from the published catalog.
 const match=matchSituation(situation,catalog)
 const aliases={birth:['khai sinh'],marriage:['ket hon'],residence:['cu tru','tam tru','thuong tru'],business:['kinh doanh'],loss:['khai tu'],other:[]}
 const hits=[...match.items]
 // If a citizen describes a life event in everyday words, look for matching
 // procedure names in the existing catalog. This NEVER invents procedures.
 for(const p of catalog){
  if(!hits.some(x=>x.id===p.id) && (aliases[event]||[]).some(w=>normalizePhrase(p.title).includes(w)))
   hits.push({id:p.id,title:p.title,summary:p.summary,score:1,source:`/thu-tuc/${encodeURIComponent(p.id)}`})
 }
 const items=hits.slice(0,6).map((item,index)=>{
  const full=catalog.find(p=>p.id===item.id)
  return {id:item.id,title:item.title,summary:item.summary,position:index+1,
   documents:(full?.documents||[]).map(d=>({code:d.document_code,name:d.document_name,required:d.is_required})),
   fee:full?.fee_note||null,durationDays:Number.isFinite(Number(full?.sla_days))?Number(full.sla_days):null,
   source:`/thu-tuc/${encodeURIComponent(item.id)}`,legalSourceVerified:false,
   dependency:'unverified',canParallel:null}
 })
 const questions=clarificationQuestions(options)
 return {event,items,questions,canSave:items.length>0,
  notice:'Lộ trình hỗ trợ từ danh mục đang công bố trong bản mô phỏng. Chưa có quy tắc phụ thuộc pháp lý được xác minh nên không tự khẳng định thứ tự bắt buộc hoặc bước có thể làm đồng thời.',
  method:'published_catalog_rules',sequenceStatus:'advisory_only'}
}
export function compareChannels(procedure,{online=true,counter=false,hybrid=false}={}){
 const ways=[]
 if(online)ways.push({code:'online',title:'Trực tuyến',visits:null,available:true,why:'Có thể kê khai trên cổng trực tuyến nếu xã tiếp nhận đã mở thủ tục.'})
 if(counter)ways.push({code:'counter',title:'Bộ phận một cửa',visits:null,available:true,why:'Có lịch hỗ trợ tại quầy trong danh mục hệ thống; cần xác minh lịch hẹn thực tế.'})
 if(hybrid)ways.push({code:'hybrid',title:'Kết hợp trực tuyến và trực tiếp',visits:null,available:true,why:'Chỉ thực hiện khi đơn vị xác nhận tuyến tiếp nhận kết hợp.'})
 return {ways,feeNote:procedure.fee_note||'Chưa có dữ liệu lệ phí',
  notice:'Số lượt đến cơ quan và lệ phí chính xác chưa được xác minh; không gán số hoặc giả định cách thức chưa được hệ thống xác nhận.'}
}
export function explainCaseStatus(status,events=[],stages=[]){
 const map={draft:'Hồ sơ mới là bản nháp, chưa gửi đến cơ quan tiếp nhận.',submitted:'Hồ sơ đã được ghi nhận là đã nộp.',processing:'Hồ sơ đang trong quá trình xử lý.',supplement:'Hồ sơ đang có yêu cầu bổ sung.',completed:'Hồ sơ được hệ thống ghi nhận đã hoàn thành.',rejected:'Hồ sơ được hệ thống ghi nhận đã từ chối.'}
 const recent=events.slice().sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0))[0]
 const stage=stages.slice().filter(x=>x.stage_status==='active'||x.stage_status==='paused').sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0))[0]
 return {summary:map[status]||'Hãy kiểm tra trạng thái trong hệ thống.',
  latestNote:recent?.note||null,stage:stage?.stage_name||null,unit:stage?.unit_name||null,
  reason:stage?.reason||null,actions:nextCaseActions(status,events[0]?.application_id||'',events[0]?.procedure_id||''),
  notice:'Chỉ sử dụng trạng thái và sự kiện đã lưu; không suy đoán nguyên nhân nếu cán bộ chưa ghi nhận.'}
}
export function followupTasks(cases=[]){
 return cases.flatMap(a=>{
  const actions=nextCaseActions(a.status,a.id,a.procedure_id)
  return actions.slice(0,1).map(action=>({caseId:a.id,procedure:a.procedure_title,kind:a.status,
   title:action.title,reason:action.reason,url:action.url,updatedAt:a.updated_at}))
 }).sort((a,b)=>Number(a.kind==='supplement')-Number(b.kind==='supplement')||Date.parse(b.updatedAt||0)-Date.parse(a.updatedAt||0)).reverse()
}
