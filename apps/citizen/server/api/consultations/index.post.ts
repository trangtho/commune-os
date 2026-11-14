// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../utils/database'
import { validate } from '../../utils/validation'
import { phoneIssue } from '../../../shared/identity-validation'
const schema = z.object({
  category:z.string().trim().min(2).max(80),
  subject:z.string().trim().min(5).max(150),
  description:z.string().trim().min(10).max(2000),
  channel:z.enum(['phone','online']),
  contactPhone:z.string().trim().min(9).max(15).refine(v=>!phoneIssue(v),'Số điện thoại không hợp lệ'),
  // ISO 8601 with +07:00 offset, or a published slot provides its own timestamp.
  preferredAt:z.string().datetime({offset:true}),
  slotId:z.string().uuid().nullable().optional()
})
export default defineEventHandler(async event => {
  const body=validate(schema,await readBody(event))
  const chosen=new Date(body.preferredAt)
  const offset=chosen.valueOf()-Date.now()
  if (!Number.isFinite(offset) || offset<60*60*1000 || offset>31*24*60*60*1000)
    throw createError({statusCode:422,statusMessage:'Vui lòng chọn thời gian từ 1 giờ đến 31 ngày tới'})
  const result=await citizenTx(event,async(client,actor)=>{
    const active=Number((await client.query(`SELECT count(*)::int AS total FROM citizen_consultation_requests
      WHERE status IN ('pending','confirmed') AND preferred_at>now()`)).rows[0].total)
    if(active>=3) throw createError({statusCode:429,statusMessage:'Bạn đang có 3 lịch tư vấn chưa kết thúc'})
    const found=(await client.query('SELECT 1 FROM procedures WHERE published AND category=$1 LIMIT 1',[body.category])).rowCount
    if(!found) throw createError({statusCode:422,statusMessage:'Lĩnh vực tư vấn không có trong danh mục'})
    if(body.slotId){
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[body.slotId])
      const slot=(await client.query(`SELECT id,category,starts_at FROM citizen_consultation_slots
        WHERE id=$1 AND is_published AND starts_at>now()+interval '1 hour' AND starts_at<now()+interval '31 days'`,[body.slotId])).rows[0]
      if(!slot || slot.category!==body.category || Math.abs(new Date(slot.starts_at).valueOf()-chosen.valueOf())>1000)
        throw createError({statusCode:409,statusMessage:'Khung giờ đã thay đổi hoặc không phù hợp'})
      const remaining=Number((await client.query('SELECT citizen_slot_remaining($1) AS n',[body.slotId])).rows[0].n)
      if(remaining<=0)throw createError({statusCode:409,statusMessage:'Khung giờ đã hết lượt đăng ký; vui lòng chọn thời gian khác'})
    }
    return (await client.query(`INSERT INTO citizen_consultation_requests
      (citizen_id,tenant_id,category,subject,description,channel,contact_phone,preferred_at,slot_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,status,preferred_at`,
      [actor.id,actor.tenantId,body.category,body.subject,body.description,body.channel,body.contactPhone,chosen,body.slotId||null])).rows[0]
  })
  setResponseStatus(event,201)
  return {...result,message:'Đã gửi yêu cầu; lịch hẹn chưa được cán bộ xác nhận.'}
})
