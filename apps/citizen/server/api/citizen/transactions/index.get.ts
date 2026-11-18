// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {recordPersonalDataUse} from '../../../utils/privacy-events'
const allowed=new Set(['all','draft','submitted','processing','supplement','completed','rejected'])
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 const query=getQuery(event)
 const filter=typeof query.status==='string'&&allowed.has(query.status)?query.status:'all'
 const text=typeof query.q==='string'?query.q.trim().slice(0,90):''
 const rows=(await client.query(`SELECT a.id,a.status,p.title AS procedure_title,a.submitted_at,a.updated_at,
   COALESCE(json_agg(json_build_object('id',e.id,'eventType',e.event_type,'note',e.note,
   'at',e.created_at,'actor',e.actor_name) ORDER BY e.created_at,e.id)
   FILTER (WHERE e.id IS NOT NULL),'[]'::json) AS events
  FROM applications a JOIN procedures p ON p.id=a.procedure_id
  LEFT JOIN application_events e ON e.application_id=a.id
  WHERE ($1='all' OR a.status=$1) AND ($2='' OR a.id ILIKE '%'||$2||'%' OR p.title ILIKE '%'||$2||'%')
  GROUP BY a.id,p.id ORDER BY a.updated_at DESC LIMIT 100`,[filter,text])).rows
 await recordPersonalDataUse(client,actor,{action:'view_case',purpose:'Xem sổ giao dịch hành chính',resourceKind:'administrative_ledger',resourceReference:'self'})
 const items=rows.flatMap(r=>[
  {caseId:r.id,title:r.procedure_title,status:r.status,eventType:'case_status',note:'Trạng thái hiện tại: '+r.status,at:r.updated_at},
  ...(r.events||[]).map((e:any)=>({caseId:r.id,title:r.procedure_title,status:r.status,eventType:e.eventType,note:e.note,at:e.at}))
 ]).sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,500)
 if(query.format==='csv'){
  const esc=(value:unknown)=>{const safe=String(value??'').replace(/^[\s]*[=+@-]/,match=>"'"+match);return '"'+safe.replace(/"/g,'""')+'"'}
  const lines=[['Mã hồ sơ','Thủ tục','Trạng thái','Sự kiện','Nội dung','Thời điểm'],...items.map(x=>[x.caseId,x.title,x.status,x.eventType,x.note,x.at])]
  setResponseHeader(event,'content-type','text/csv; charset=utf-8')
  setResponseHeader(event,'content-disposition','attachment; filename="so-giao-dich-cong-dan.csv"')
  setResponseHeader(event,'cache-control','private, no-store')
  return '\ufeff'+lines.map(row=>row.map(esc).join(',')).join('\r\n')
 }
 return {items,total:items.length,notice:'Tổng hợp từ sự kiện đang lưu trong CommuneOS; không bao gồm giao dịch chưa được tích hợp.'}
}))
