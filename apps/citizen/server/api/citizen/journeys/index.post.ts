// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {validate} from '../../../utils/validation'
import {citizenTx} from '../../../utils/database'
const schema=z.object({title:z.string().trim().min(3).max(120),situation:z.string().trim().max(500).default(''),
 eventCode:z.enum(['birth','marriage','residence','business','loss','other']).default('other'),
 procedureIds:z.array(z.string().regex(/^[a-z0-9-]{2,80}$/)).min(1).max(6)}).strict()
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 if(new Set(body.procedureIds).size!==body.procedureIds.length)throw createError({statusCode:422,statusMessage:'Một thủ tục không thể xuất hiện hai lần'})
 const created=await citizenTx(event,async(client,actor)=>{
  const found=(await client.query(`SELECT p.id FROM procedures p WHERE p.published=true AND p.id=ANY($1::text[])
   AND public.procedure_enabled_for($2::uuid,p.id)`,[body.procedureIds,actor.tenantId])).rows
  if(found.length!==body.procedureIds.length)throw createError({statusCode:422,statusMessage:'Có thủ tục chưa mở tại xã của bạn hoặc không còn công bố'})
  const {rows}=await client.query(`INSERT INTO citizen_life_journeys(citizen_id,tenant_id,title,situation,event_code)
  VALUES($1,$2,$3,$4,$5) RETURNING id`,[actor.id,actor.tenantId,body.title,body.situation,body.eventCode])
  for(const [index,id] of body.procedureIds.entries())await client.query(`INSERT INTO citizen_life_journey_items
   (journey_id,citizen_id,tenant_id,procedure_id,position) VALUES($1,$2,$3,$4,$5)`,
   [rows[0].id,actor.id,actor.tenantId,id,index+1])
  return {id:rows[0].id}
 })
 setResponseStatus(event,201)
 return {...created,notice:'Đã lưu lộ trình chuẩn bị. Chưa tạo hoặc nộp bất kỳ hồ sơ nào.'}
})
