// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../utils/database'
import { validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const body=validate(z.object({subject:z.string().trim().min(3).max(150),message:z.string().trim().min(10).max(3000)}),await readBody(event))
  return citizenTx(event,async(client,actor)=>{
    await client.query('INSERT INTO citizen_feedback(citizen_id,tenant_id,subject,message) VALUES($1,$2,$3,$4)',[actor.id,actor.tenantId,body.subject,body.message])
    return {ok:true}
  })
})
