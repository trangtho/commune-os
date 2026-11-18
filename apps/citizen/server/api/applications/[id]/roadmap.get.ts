// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {nextCaseActions} from '../../../../shared/citizen-intelligence.mjs'
import {explainCaseStatus} from '../../../../shared/life-journey.mjs'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=String(getRouterParam(event,'id')||'')
 const a=(await client.query('SELECT id,procedure_id,status,due_at,updated_at FROM applications WHERE id=$1',[id])).rows[0]
 if(!a)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
 const [events,stages,changes,supplements]=await Promise.all([
  client.query('SELECT application_id,event_type,note,created_at FROM application_events WHERE application_id=$1 ORDER BY created_at DESC LIMIT 15',[id]),
  client.query('SELECT stage_name,unit_name,stage_status,reason,created_at FROM citizen_case_stage_updates WHERE application_id=$1 ORDER BY created_at DESC LIMIT 15',[id]),
  client.query(`SELECT a.acknowledged_procedure_version_id,v.id AS latest_version FROM applications a
   LEFT JOIN LATERAL(SELECT id FROM citizen_procedure_versions WHERE procedure_id=a.procedure_id ORDER BY version_no DESC LIMIT 1)v ON true WHERE a.id=$1`,[id]),
  client.query(`SELECT count(*)::int AS unresolved FROM citizen_supplement_items WHERE application_id=$1 AND responded_at IS NULL`,[id])
 ])
 const explanation=explainCaseStatus(a.status,events.rows,stages.rows)
 const needsVersionAck=a.status==='draft'&&!!changes.rows[0]?.latest_version&&changes.rows[0]?.latest_version!==changes.rows[0]?.acknowledged_procedure_version_id
 const actions=nextCaseActions(a.status,id,a.procedure_id)
 if(needsVersionAck)actions.unshift({title:'Kiểm tra phiên bản thủ tục mới',url:`/nop-ho-so/${encodeURIComponent(a.procedure_id)}?draft=${encodeURIComponent(id)}&step=2`,reason:'Bản nháp chưa xác nhận phiên bản đang áp dụng.'})
 return {applicationId:id,status:a.status,updatedAt:a.updated_at,dueAt:a.due_at,
  explanation,needsVersionAck,unresolvedSupplements:supplements.rows[0]?.unresolved||0,
  actions,events:events.rows.slice(0,8),stages:stages.rows.slice(0,8),
  notice:'Lộ trình dựa trên sự kiện hồ sơ đã lưu, không đoán nguyên nhân hoặc tự thay đổi quyết định cán bộ.'}
}))
