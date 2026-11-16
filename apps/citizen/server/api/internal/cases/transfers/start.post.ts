// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { db } from '../../../../utils/database'
import { requireStaffBridge } from '../../../../utils/staff-bridge'
import { validate } from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 const body=validate(z.object({requestId:z.string().uuid(),response:z.string().trim().min(5).max(1000)}),await readBody(event))
 const id=(await db().query('SELECT citizen_staff_start_case_transfer($1::uuid,$2::uuid,$3,$4) AS id',
  [body.requestId,staff.tenantId,staff.staffId,body.response])).rows[0]?.id
 if(!id)throw createError({statusCode:404,statusMessage:'Yêu cầu chuyển không hợp lệ hoặc không thuộc quyền xử lý'})
 setResponseStatus(event,201)
 return {id,status:'pending'}
})
