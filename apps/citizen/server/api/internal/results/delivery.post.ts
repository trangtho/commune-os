// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { db } from '../../../utils/database'
import { requireStaffBridge } from '../../../utils/staff-bridge'
import { validate } from '../../../utils/validation'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 const body=validate(z.object({applicationId:z.string().trim().min(5).max(50),
  status:z.enum(['ready','in_transit','delivered','failed']),
  shipmentReference:z.string().trim().max(120).default(''),note:z.string().trim().max(1000).default('')}),await readBody(event))
 const ok=(await db().query('SELECT citizen_staff_update_delivery($1,$2::uuid,$3,$4,$5,$6) AS ok',
  [body.applicationId,staff.tenantId,staff.staffId,body.status,body.shipmentReference,body.note])).rows[0]?.ok
 if(!ok)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ hoặc phương thức nhận kết quả chưa đăng ký'})
 return {ok:true}
})
