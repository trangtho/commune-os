// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { db } from '../../../utils/database'
import { requireStaffBridge } from '../../../utils/staff-bridge'
import { validate } from '../../../utils/validation'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 const body=validate(z.object({procedureId:z.string().regex(/^[a-z0-9-]{2,80}$/),
  method:z.enum(['online','counter','postal']),approvalReference:z.string().trim().min(5).max(200),
  validUntil:z.string().datetime({offset:true}),instructions:z.string().trim().max(1000).default('')}),await readBody(event))
 const ok=(await db().query('SELECT citizen_staff_publish_result_channel($1,$2::uuid,$3,$4,$5::timestamptz,$6) AS ok',
 [body.procedureId,staff.tenantId,body.method,body.approvalReference,body.validUntil,body.instructions])).rows[0]?.ok
 return {ok:Boolean(ok)}
})
