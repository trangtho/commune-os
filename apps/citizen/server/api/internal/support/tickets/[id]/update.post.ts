// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { db } from '../../../../../utils/database'
import { requireStaffBridge } from '../../../../../utils/staff-bridge'
import { validate } from '../../../../../utils/validation'
export default defineEventHandler(async event=>{
  const staff=requireStaffBridge(event)
  const id=getRouterParam(event,'id')||''
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã định danh không hợp lệ'})
  const body=validate(z.object({status:z.enum(['processing','waiting_citizen','answered','resolved','closed']),
    message:z.string().trim().max(3000).default(''),resolution:z.string().trim().max(2000).default('')}),await readBody(event))
  const ok=(await db().query('SELECT citizen_staff_update_support_ticket($1::uuid,$2::uuid,$3,$4,$5,$6) AS ok',
    [id,staff.tenantId,staff.staffId,body.status,body.message,body.resolution])).rows[0]?.ok
  if(!ok)throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu trong địa phương được phân quyền'})
  return {ok:true}
})
