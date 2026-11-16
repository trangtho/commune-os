// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { db } from '../../../../../utils/database'
import { requireStaffBridge } from '../../../../../utils/staff-bridge'
import { validate } from '../../../../../utils/validation'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 const id=validate(z.string().uuid(),getRouterParam(event,'id'))
 const body=validate(z.object({accepted:z.boolean(),reason:z.string().trim().min(5).max(1000)}),await readBody(event))
 const done=(await db().query('SELECT citizen_staff_accept_case_transfer($1::uuid,$2::uuid,$3,$4,$5) AS done',
  [id,staff.tenantId,staff.staffId,body.accepted,body.reason])).rows[0]?.done
 if(!done)throw createError({statusCode:404,statusMessage:'Chỉ đơn vị nhận được phép quyết định đề nghị đang chờ'})
 return {ok:true}
})
