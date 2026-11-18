// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 setHeader(event,'Cache-Control','private, no-store')
 const [settings,tasks,cases,bookings]=await Promise.all([
 client.query('SELECT enabled,days_before FROM citizen_reminder_settings WHERE citizen_id=$1',[actor.id]),
 client.query('SELECT id,title,due_on,completed_at,application_id FROM citizen_personal_tasks ORDER BY due_on ASC LIMIT 100'),
 client.query(`SELECT id,procedure_id,status,due_at FROM applications WHERE status IN ('submitted','processing','supplement') AND due_at IS NOT NULL ORDER BY due_at LIMIT 50`),
 client.query(`SELECT b.id,b.status,s.starts_at,p.title FROM citizen_counter_bookings b JOIN citizen_counter_slots s ON s.id=b.slot_id JOIN procedures p ON p.id=b.procedure_id WHERE b.status='booked' AND s.starts_at>=now() ORDER BY s.starts_at LIMIT 40`)
 ])
 const items=[...tasks.rows.map(t=>({...t,kind:'task',date:t.due_on})),
 ...cases.rows.map(a=>({...a,kind:'case',title:'Hạn xử lý hồ sơ '+a.id,date:a.due_at})),
 ...bookings.rows.map(b=>({...b,kind:'appointment',date:b.starts_at}))]
 return {settings:settings.rows[0]||{enabled:false,days_before:2},items:items.sort((a,b)=>Date.parse(String(a.date))-Date.parse(String(b.date))),
  notice:'Chỉ thông báo trong ứng dụng khi công dân chủ động bật nhắc việc. Hạn hồ sơ hiển thị theo thông tin đã lưu, không phải cam kết xử lý.'}
}))
