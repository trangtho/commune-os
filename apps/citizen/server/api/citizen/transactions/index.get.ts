// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Sổ giao dịch hành chính: lõi trả hồ sơ, sự kiện và ghi nhật ký sử dụng (api.citizen_transactions); xuất CSV ở đây.
import {citizenRpc} from '../../../utils/identity'
type Row={id:string;status:string;procedure_title:string;updated_at:string;events:{eventType:string;note:string;at:string}[]}
export default defineEventHandler(async event=>{
 const query=getQuery(event)
 const rows=await citizenRpc<Row[]>(event,'citizen_transactions',{p_status:typeof query.status==='string'?query.status:'all',
  p_q:typeof query.q==='string'?query.q.trim().slice(0,90):''})
 const items=rows.flatMap(r=>[
  {caseId:r.id,title:r.procedure_title,status:r.status,eventType:'case_status',note:'Trạng thái hiện tại: '+r.status,at:r.updated_at},
  ...(r.events||[]).map(e=>({caseId:r.id,title:r.procedure_title,status:r.status,eventType:e.eventType,note:e.note,at:e.at}))
 ]).sort((a,b)=>new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,500)
 if(query.format==='csv'){
  const esc=(value:unknown)=>{const safe=String(value??'').replace(/^[\s]*[=+@-]/,match=>"'"+match);return '"'+safe.replace(/"/g,'""')+'"'}
  const lines=[['Mã hồ sơ','Thủ tục','Trạng thái','Sự kiện','Nội dung','Thời điểm'],...items.map(x=>[x.caseId,x.title,x.status,x.eventType,x.note,x.at])]
  setResponseHeader(event,'content-type','text/csv; charset=utf-8')
  setResponseHeader(event,'content-disposition','attachment; filename="so-giao-dich-cong-dan.csv"')
  setResponseHeader(event,'cache-control','private, no-store')
  return '﻿'+lines.map(row=>row.map(esc).join(',')).join('\r\n')
 }
 return {items,total:items.length,notice:'Tổng hợp từ sự kiện đang lưu trong CommuneOS; không bao gồm giao dịch chưa được tích hợp.'}
})
