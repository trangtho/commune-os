// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { db } from '../../../../../utils/database'
import { requireStaffBridge } from '../../../../../utils/staff-bridge'
import { validate } from '../../../../../utils/validation'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 const id=validate(z.string().uuid(),getRouterParam(event,'id'))
 const body=validate(z.object({approved:z.boolean(),response:z.string().trim().min(5).max(1000)}),await readBody(event))
 const accepted=(await db().query('SELECT citizen_staff_decide_case_request($1::uuid,$2::uuid,$3,$4,$5) AS accepted',
  [id,staff.tenantId,staff.staffId,body.approved,body.response])).rows[0]?.accepted
 if(!accepted)throw createError({statusCode:404,statusMessage:'Yêu cầu không tồn tại, không thuộc địa phương hoặc cần quy trình chuyển cơ quan riêng'})
 return {ok:true}
})
