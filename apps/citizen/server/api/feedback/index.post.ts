// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../utils/database'
import { validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const body=validate(z.object({category:z.enum(['huong-dan','loi-ky-thuat','gop-y','phan-anh','khac']).default('khac'),subject:z.string().trim().min(3).max(130),message:z.string().trim().min(10).max(3000)}),await readBody(event))
  return citizenTx(event,async(client,actor)=>{
    const recent=Number((await client.query(`SELECT count(*)::int AS n FROM citizen_support_tickets
      WHERE created_at>now()-interval '24 hours'`)).rows[0].n)
    if(recent>=20)throw createError({statusCode:429,statusMessage:'Bạn đã gửi quá nhiều yêu cầu trong 24 giờ'})
    const feedback=(await client.query('INSERT INTO citizen_feedback(citizen_id,tenant_id,subject,message) VALUES($1,$2,$3,$4) RETURNING id',[actor.id,actor.tenantId,`[${body.category}] ${body.subject}`,body.message])).rows[0]
    const ticket=(await client.query(`INSERT INTO citizen_support_tickets(citizen_id,tenant_id,legacy_feedback_id,category,subject)
      VALUES($1,$2,$3,$4,$5) RETURNING id`,[actor.id,actor.tenantId,feedback.id,body.category,body.subject])).rows[0]
    await client.query(`INSERT INTO citizen_support_ticket_events(ticket_id,actor_type,actor_name,event_type,message)
      VALUES($1,'citizen',$2,'message',$3)`,[ticket.id,actor.name,body.message])
    return {ok:true,ticketId:ticket.id}
  })
})
