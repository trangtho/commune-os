// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { db } from '../../../utils/database'
import { requireStaffBridge } from '../../../utils/staff-bridge'
import { validate } from '../../../utils/validation'
export default defineEventHandler(async event=>{
  const staff=requireStaffBridge(event)
  const body=validate(z.object({code:z.string().regex(/^[A-Z0-9_-]{32}$/)}),await readBody(event))
  const hash=createHash('sha256').update(body.code).digest('hex')
  const result=(await db().query('SELECT citizen_staff_redeem_handoff($1,$2::uuid,$3) AS data',
    [hash,staff.tenantId,staff.staffId])).rows[0]?.data
  if(!result)throw createError({statusCode:404,statusMessage:'Mã không hợp lệ, đã hết hạn hoặc đã được sử dụng'})
  return {...result,notice:'Dữ liệu chuẩn bị tại quầy; cán bộ phải đối chiếu danh tính và hoàn tất bước tiếp nhận chính thức theo nghiệp vụ.'}
})
