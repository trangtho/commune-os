// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=String(getRouterParam(event,'id')||'')
 if(!/^[0-9a-f-]{36}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã lộ trình không hợp lệ'})
 const journey=(await client.query('SELECT * FROM citizen_life_journeys WHERE id=$1',[id])).rows[0]
 if(!journey)throw createError({statusCode:404,statusMessage:'Không tìm thấy lộ trình'})
 const items=(await client.query(`SELECT i.id,i.procedure_id,i.position,i.state,i.application_id,i.updated_at,p.title,p.summary,
 p.fee_note,p.sla_days,a.status AS application_status,a.updated_at AS application_updated_at,
 v.provenance_status,v.source_url,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('code',d.document_code,'name',d.document_name,'required',d.is_required) ORDER BY d.document_code)
 FROM procedure_documents d WHERE d.procedure_id=i.procedure_id),'[]'::jsonb) AS documents
 FROM citizen_life_journey_items i JOIN procedures p ON p.id=i.procedure_id
 LEFT JOIN applications a ON a.id=i.application_id
 LEFT JOIN LATERAL(SELECT provenance_status,source_url FROM citizen_procedure_versions WHERE procedure_id=i.procedure_id ORDER BY version_no DESC LIMIT 1)v ON true
 WHERE i.journey_id=$1 ORDER BY i.position`,[id])).rows
 const actions=items.map(i=>({itemId:i.id,caseId:i.application_id,
  status:i.application_status||i.state,readyToStart:!i.application_id,
  href:i.application_id ? (i.application_status==='draft'?`/nop-ho-so/${encodeURIComponent(i.procedure_id)}?draft=${encodeURIComponent(i.application_id)}&step=1`:`/ho-so/${encodeURIComponent(i.application_id)}`):`/thu-tuc/${encodeURIComponent(i.procedure_id)}`}))
 return {...journey,items,actions,notice:'Trình tự là danh sách chuẩn bị do bạn chọn; chưa có dữ liệu xác nhận quan hệ phụ thuộc và khả năng xử lý song song.'}
}))
