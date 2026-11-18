// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export type ChangeSection = 'documents'|'fees'|'deadline'|'forms'|'conditions'|'source'|'description'|'scope'
export const changeLabels: Record<ChangeSection, string> = {
  documents:'Giấy tờ cần chuẩn bị',fees:'Lệ phí',deadline:'Thời hạn giải quyết',
  forms:'Biểu mẫu',conditions:'Điều kiện / cách thực hiện',source:'Nguồn pháp lý',
  description:'Thông tin chung',scope:'Phạm vi áp dụng'
}
export type ProcedureSnapshot={title:string;summary:string;instructions:string;feeNote:string;
 slaDays:number;formRevision:string;documents:{documentCode:string;documentName:string;isRequired:boolean}[]}
export function canonicalDocuments(docs:ProcedureSnapshot['documents']){
 return [...docs].sort((a,b)=>a.documentCode.localeCompare(b.documentCode,'en'))
}
export function changedSections(a:ProcedureSnapshot,b:ProcedureSnapshot):ChangeSection[]{
 const changed:ChangeSection[]=[]
 if(JSON.stringify(canonicalDocuments(a.documents))!==JSON.stringify(canonicalDocuments(b.documents)))changed.push('documents')
 if(a.feeNote!==b.feeNote)changed.push('fees')
 if(a.slaDays!==b.slaDays)changed.push('deadline')
 if(a.formRevision!==b.formRevision)changed.push('forms')
 if(a.instructions!==b.instructions)changed.push('conditions')
 if(a.title!==b.title||a.summary!==b.summary)changed.push('description')
 return changed
}
/** A URL is not legal evidence by itself; only allow official government-hosted HTTPS sources. */
export function isOfficialProcedureSource(url:string){
 try {
  const value=new URL(url)
  const host=value.hostname.toLowerCase()
  return value.protocol==='https:' && !value.username && !value.password &&
   (host==='gov.vn'||host.endsWith('.gov.vn')||host==='chinhphu.vn'||host.endsWith('.chinhphu.vn')||host==='vbpl.vn'||host.endsWith('.vbpl.vn'))
 }catch{return false}
}
