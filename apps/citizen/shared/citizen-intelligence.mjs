// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Deterministic assistance: no claim of model inference or legally binding decision.
export function normalizePhrase(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()
}
const intents = [
  {tags:['sinh con','moi sinh','giay khai sinh','ten em be','khai sinh'],tokens:['khai sinh','tre so sinh']},
  {tags:['ket hon','cuoi nhau','dang ky cuoi','lam dam cuoi'],tokens:['ket hon']},
  {tags:['mo quan','mo cua hang','kinh doanh','buon ban'],tokens:['ho kinh doanh']},
  {tags:['thuong tru','tam tru','xac nhan dia chi','cu tru'],tokens:['cu tru']},
  {tags:['photo cong chung','chung thuc','sao y','ban sao'],tokens:['chung thuc']},
  {tags:['so do','dat dai','quyen su dung dat','thua dat'],tokens:['dat dai']}
]
export function matchSituation(query, catalog) {
  const plain=normalizePhrase(query).slice(0,400)
  if (plain.length<5) return {items:[],questions:['Bạn có thể mô tả rõ việc mình cần làm không?'],method:'rules'}
  const relevant=[]
  const words=plain.split(' ').filter(w=>w.length>2)
  for(const p of catalog){
    const hay=normalizePhrase([p.title,p.summary,p.category].join(' '))
    let score=0
    for(const term of intents){ if(term.tags.some(t=>plain.includes(normalizePhrase(t))) && term.tokens.some(t=>hay.includes(normalizePhrase(t)))) score+=10 }
    for(const w of new Set(words))if(hay.split(' ').includes(w))score+=1
    if(score>0)relevant.push({id:p.id,title:p.title,summary:p.summary,score,source:`/thu-tuc/${encodeURIComponent(p.id)}`})
  }
  relevant.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title,'vi'))
  return {items:relevant.slice(0,5),questions:relevant.length?['Bạn thực hiện thủ tục cho bản thân hay đại diện người khác?','Bạn dự định thực hiện tại địa phương nào?']:['Bạn cần làm giấy tờ cho sự kiện gì (khai sinh, cư trú, kinh doanh...)?'],method:'rules',notice:'Gợi ý từ danh mục thủ tục demo, cần kiểm tra nguồn pháp lý và điều kiện thực tế.'}
}
export function nextCaseActions(status, applicationId, procedureId='') {
  const target=encodeURIComponent(String(applicationId))
  const map={
    draft:[{title:'Hoàn thiện bản nháp',url:procedureId?`/nop-ho-so/${encodeURIComponent(procedureId)}?draft=${target}&step=1`:`/ho-so/${target}`,reason:'Hồ sơ chưa nộp; hãy kiểm tra quy định mới và giấy tờ.'}],
    supplement:[{title:'Bổ sung giấy tờ',url:`/ho-so/${target}/bo-sung`,reason:'Hồ sơ đang yêu cầu bổ sung; xem thông báo cụ thể.'}],
    completed:[{title:'Nhận và kiểm chứng kết quả',url:`/ho-so/${target}/ket-qua`,reason:'Cơ quan đã ghi nhận trạng thái hoàn thành.'}],
    processing:[{title:'Theo dõi tiến độ',url:`/ho-so/${target}/yeu-cau`,reason:'Hồ sơ đang xử lý; kiểm tra công đoạn và thông báo.'}],
    submitted:[{title:'Theo dõi tiếp nhận',url:`/ho-so/${target}`,reason:'Hồ sơ đã nộp; chờ cập nhật từ đơn vị xử lý.'}],
    rejected:[{title:'Kiểm tra lý do và hướng nộp lại',url:`/ho-so/${target}/yeu-cau`,reason:'Chỉ dựa trên thông báo chính thức của cơ quan.'}]
  }
  return map[status] || [{title:'Xem chi tiết hồ sơ',url:`/ho-so/${target}`,reason:'Cần xác minh trạng thái hiện tại.'}]
}
export function groupQuestionTopic(question){
  const text=normalizePhrase(question)
  const topics=[['documents',['giay to','tai lieu','ho so','bo sung']],['fees',['le phi','phi','tien']],['duration',['bao lau','thoi han','tre han','khi nao']],['identity',['can cuoc','dinh danh','xac thuc']],['routing',['dia phuong','co quan','noi nop']],['eligibility',['dieu kien','du dieu kien','doi tuong']]]
  return topics.find(([k,patterns])=>patterns.some(v=>text.includes(v)))?.[0]||'other'
}
export function compareObservedFields(formData, observations){
  const byField=new Map();const findings=[]
  for(const obs of observations){
    for(const [key,val] of Object.entries(obs.fields||{})){
      const normalized=normalizePhrase(val)
      if(!normalized)continue
      if(!byField.has(key))byField.set(key,[])
      byField.get(key).push({value:String(val),norm:normalized,source:obs.source||'Giấy tờ'})
    }
  }
  for(const [key,entries] of byField){
    const unique=new Set(entries.map(x=>x.norm))
    if(unique.size>1)findings.push({field:key,kind:'between_documents',sources:entries.map(x=>x.source),message:`Thông tin ${key} khác nhau giữa các giấy tờ. Cần kiểm tra thực tế.`})
    const declared=formData?.[key]
    if(declared && !unique.has(normalizePhrase(declared)))findings.push({field:key,kind:'against_form',sources:entries.map(x=>x.source),message:`Thông tin ${key} trên biểu mẫu có thể không trùng với giấy tờ.`})
  }
  return findings
}
export function getForecast(days){
  const sorted=days.filter(n=>Number.isFinite(n)&&n>=0).sort((a,b)=>a-b)
  if(sorted.length<10)return {available:false,sampleSize:sorted.length,reason:'Chưa đủ tối thiểu 10 hồ sơ đã hoàn thành cùng thủ tục và địa phương để dự báo.'}
  const quantile=q=>{const i=(sorted.length-1)*q;const lo=Math.floor(i);return sorted[lo]+((sorted[Math.ceil(i)]||sorted[lo])-sorted[lo])*(i-lo)}
  return {available:true,sampleSize:sorted.length,lowerDays:Math.max(0,Math.floor(quantile(.25))),upperDays:Math.ceil(quantile(.75)),confidence:'tham khảo',method:'percentile_25_75'}
}
export function guideFormField(field, procedure){
  return {key:field.key,label:field.label,description:field.help||`Nhập ${field.label.toLowerCase()} theo giấy tờ phù hợp.`,required:!!field.required,format:field.type,source:procedure?.source_url||null,notice:'Gợi ý thao tác, không thay thế quy định hoặc kết luận pháp lý.'}
}
