// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../../../utils/database'
import { validate } from '../../../../utils/validation'
import { stageEligible } from '../../../../../shared/stage-feedback'
const schema=z.object({stage:z.enum(['guidance','reception','supplement','result']),rating:z.number().int().min(1).max(5),comment:z.string().trim().max(1000).default('')})
export default defineEventHandler(async event=>{
  const id=getRouterParam(event,'id') || ''
  const body=validate(schema,await readBody(event))
  return citizenTx(event,async (client,actor)=>{
    const app=(await client.query('SELECT status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
    if(!app)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
    const events=(await client.query('SELECT event_type FROM application_events WHERE application_id=$1',[id])).rows.map(r=>r.event_type)
    if(!stageEligible(body.stage,app.status,events))throw createError({statusCode:409,statusMessage:'Hồ sơ chưa đến giai đoạn có thể đánh giá'})
    try{
      const result=await client.query(`INSERT INTO citizen_stage_reviews
        (application_id,citizen_id,tenant_id,stage,rating,comment)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(application_id,citizen_id,stage) DO NOTHING
        RETURNING id,stage,rating,comment,created_at`,[id,actor.id,actor.tenantId,body.stage,body.rating,body.comment])
      if(!result.rowCount)throw createError({statusCode:409,statusMessage:'Bạn đã đánh giá giai đoạn này'})
      setResponseStatus(event,201)
      return result.rows[0]
    } catch(e){throw e}
  })
})
