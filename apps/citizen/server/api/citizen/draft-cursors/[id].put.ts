// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {validate} from '../../../utils/validation'
import {z} from 'zod'
const schema=z.object({step:z.number().int().min(1).max(3)}).strict()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 return citizenTx(event,async(client,actor)=>{
  const id=String(getRouterParam(event,'id')||'')
  const exists=(await client.query('SELECT 1 FROM applications WHERE id=$1 AND status=\'draft\'',[id])).rowCount
  if(!exists)throw createError({statusCode:404,statusMessage:'Không tìm thấy bản nháp của bạn'})
  const r=await client.query(`INSERT INTO citizen_draft_cursors(application_id,citizen_id,tenant_id,step)
  VALUES($1,$2,$3,$4) ON CONFLICT(application_id) DO UPDATE SET step=excluded.step,updated_at=now() RETURNING step,revision,updated_at`,
  [id,actor.id,actor.tenantId,input.step])
  return r.rows[0]
 })
})
