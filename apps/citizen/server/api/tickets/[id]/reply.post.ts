// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../../utils/database'
import { validate } from '../../../utils/validation'
export default defineEventHandler(async event=>{
  const id=getRouterParam(event,'id')||''
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã định danh không hợp lệ'})
  const {message}=validate(z.object({message:z.string().trim().min(5).max(3000)}),await readBody(event))
  return citizenTx(event,async(client,actor)=>{
    const recent=Number((await client.query(`SELECT count(*)::int AS n FROM citizen_support_ticket_events
      WHERE ticket_id=$1 AND actor_type='citizen' AND created_at>now()-interval '24 hours'`,[id])).rows[0].n)
    if(recent>=40)throw createError({statusCode:429,statusMessage:'Đã vượt số lượt phản hồi trong 24 giờ'})
    const result=(await client.query('SELECT citizen_reply_support_ticket($1::uuid,$2,$3) AS status',[id,message,actor.name])).rows[0]?.status
    if(!result)throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu hoặc không có quyền trả lời'})
    return {ok:true,status:result}
  })
})
