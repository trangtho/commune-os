// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../utils/database'
import { validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const b=validate(z.object({applicationId:z.string().max(50).optional(),message:z.string().trim().min(5).max(2000)}),await readBody(event))
  return citizenTx(event,async(client,actor)=>{
    if(b.applicationId && !(await client.query('SELECT 1 FROM applications WHERE id=$1',[b.applicationId])).rowCount)
      throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
    await client.query('INSERT INTO citizen_support_messages(citizen_id,tenant_id,application_id,message) VALUES($1,$2,$3,$4)',[actor.id,actor.tenantId,b.applicationId||null,b.message])
    return {ok:true}
  })
})
