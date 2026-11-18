// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {followupTasks} from '../../../../shared/life-journey.mjs'
import {recordPersonalDataUse} from '../../../utils/privacy-events'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 setHeader(event,'Cache-Control','private, no-store')
 const [cases,plans,vault,alerts,tasks,bookings]=await Promise.all([
  client.query(`SELECT a.id,a.procedure_id,p.title AS procedure_title,a.status,a.updated_at,a.due_at FROM applications a JOIN procedures p ON p.id=a.procedure_id ORDER BY a.updated_at DESC LIMIT 50`),
  client.query(`SELECT j.id,j.title,j.event_code,j.status,j.updated_at,count(i.id)::int AS steps FROM citizen_life_journeys j LEFT JOIN citizen_life_journey_items i ON j.id=i.journey_id GROUP BY j.id ORDER BY j.updated_at DESC LIMIT 12`),
  client.query(`SELECT count(*)::int AS total FROM citizen_vault_documents WHERE archived_at IS NULL`),
  client.query(`SELECT id,title,created_at FROM citizen_notifications WHERE NOT is_read ORDER BY created_at DESC LIMIT 8`),
  client.query(`SELECT id,title,due_on,completed_at,application_id FROM citizen_personal_tasks WHERE completed_at IS NULL ORDER BY due_on LIMIT 30`),
  client.query(`SELECT b.id,s.starts_at,p.title FROM citizen_counter_bookings b JOIN citizen_counter_slots s ON s.id=b.slot_id JOIN procedures p ON p.id=b.procedure_id WHERE s.starts_at>=now() ORDER BY s.starts_at LIMIT 8`)
 ])
 await recordPersonalDataUse(client,actor,{action:'view_case',purpose:'Tổng hợp không gian quản lý hành chính cá nhân',resourceKind:'workspace',resourceReference:'self'})
 return {cases:cases.rows,plans:plans.rows,vaultCount:vault.rows[0]?.total||0,
  unreadAlerts:alerts.rows,tasks:tasks.rows,bookings:bookings.rows,
  nextActions:followupTasks(cases.rows).slice(0,12),
  notice:'Dữ liệu chỉ thuộc tài khoản đang đăng nhập. Gợi ý công việc dựa trên trạng thái thực tế; không tự khởi tạo hoặc nộp hồ sơ.'}
}))
