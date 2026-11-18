// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {validate} from '../../../utils/validation'
import {citizenTx} from '../../../utils/database'
const schema=z.object({enabled:z.boolean(),daysBefore:z.number().int().min(0).max(14)}).strict()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 return citizenTx(event,async(client,actor)=>{
  await client.query(`INSERT INTO citizen_reminder_settings(citizen_id,tenant_id,enabled,days_before)
   VALUES($1,$2,$3,$4) ON CONFLICT(citizen_id) DO UPDATE SET enabled=excluded.enabled,days_before=excluded.days_before,updated_at=now()`,
   [actor.id,actor.tenantId,input.enabled,input.daysBefore])
  return {enabled:input.enabled,daysBefore:input.daysBefore,channel:'in_app_only'}
 })
})
