// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {validate} from '../../../utils/validation'
import {requireStaffBridge} from '../../../utils/staff-bridge'
import {requireGovernanceToken} from '../../../utils/governance'
import {db} from '../../../utils/database'
const schema=z.object({requestId:z.string().uuid(),decision:z.enum(['reviewed','rejected']),note:z.string().trim().min(8).max(500)}).strict()
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event);requireGovernanceToken(event)
 const body=validate(schema,await readBody(event))
 const result=await db().query('SELECT citizen_staff_sync_decide($1,$2,$3,$4) AS ok',
  [staff.tenantId,body.requestId,body.decision,body.note])
 if(!result.rows[0]?.ok)throw createError({statusCode:404,statusMessage:'Yêu cầu không thuộc địa phương hoặc đã được xử lý'})
 return {ok:true,notice:'Đã ghi nhận quyết định xem xét; không tự cập nhật hồ sơ gốc.'}
})
