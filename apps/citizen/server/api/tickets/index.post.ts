// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../utils/database'
import { validate } from '../../utils/validation'
export const ticketSchema=z.object({
  category:z.enum(['huong-dan','loi-ky-thuat','gop-y','phan-anh','khac']),
  subject:z.string().trim().min(3).max(150),
  message:z.string().trim().min(10).max(3000),
  applicationId:z.string().trim().max(50).optional()
})
export default defineEventHandler(async event=>{
  const body=validate(ticketSchema,await readBody(event))
  const data=await citizenTx(event,async(client,actor)=>{
    const recent=Number((await client.query(`SELECT count(*)::int AS n FROM citizen_support_tickets
      WHERE created_at>now()-interval '24 hours'`)).rows[0].n)
    if(recent>=20)throw createError({statusCode:429,statusMessage:'Bạn đã gửi quá nhiều yêu cầu trong 24 giờ'})
    if(body.applicationId && !(await client.query('SELECT 1 FROM applications WHERE id=$1',[body.applicationId])).rowCount)
      throw createError({statusCode:404,statusMessage:'Không có quyền truy cập hồ sơ liên quan'})
    const id=(await client.query(`INSERT INTO citizen_support_tickets(citizen_id,tenant_id,application_id,category,subject)
      VALUES($1,$2,$3,$4,$5) RETURNING id,created_at`,[actor.id,actor.tenantId,body.applicationId||null,body.category,body.subject])).rows[0]
    await client.query(`INSERT INTO citizen_support_ticket_events(ticket_id,actor_type,actor_name,event_type,message)
      VALUES($1,'citizen',$2,'message',$3)`,[id.id,actor.name,body.message])
    return {id:id.id,createdAt:id.created_at,status:'received',code:`YC-${String(id.id).slice(0,8).toUpperCase()}`}
  })
  setResponseStatus(event,201)
  return data
})
