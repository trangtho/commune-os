// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','private, no-store')
  const id=getRouterParam(event,'id')||''
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã định danh không hợp lệ'})
  return citizenTx(event,async(client)=>{
    const t=(await client.query(`SELECT id,category,subject,status,assigned_staff AS "assignedStaff",resolution,
      application_id AS "applicationId",created_at AS "createdAt",updated_at AS "updatedAt"
      FROM citizen_support_tickets WHERE id=$1`,[id])).rows[0]
    if(!t)throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu hoặc không có quyền truy cập'})
    const events=(await client.query(`SELECT id,actor_type AS "actorType",actor_name AS "actorName",
      event_type AS "eventType",message,status,created_at AS "createdAt"
      FROM citizen_support_ticket_events WHERE ticket_id=$1 ORDER BY id ASC LIMIT 200`,[id])).rows
    return {...t,events}
  })
})
