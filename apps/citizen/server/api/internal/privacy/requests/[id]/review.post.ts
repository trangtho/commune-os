// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {db} from '../../../../../utils/database'
import {requireGovernanceToken} from '../../../../../utils/governance'
import {requireStaffBridge} from '../../../../../utils/staff-bridge'
import {validate} from '../../../../../utils/validation'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 requireGovernanceToken(event)
 const body=validate(z.object({state:z.enum(['reviewing','resolved','declined']),
  note:z.string().trim().min(5).max(1200)}).strict(),await readBody(event))
 const result=await db().query(`SELECT citizen_staff_review_privacy_request($1::uuid,$2::uuid,$3,$4,$5) AS ok`,
  [getRouterParam(event,'id'),staff.tenantId,staff.staffId,body.state,body.note])
 if(!result.rows[0]?.ok)throw createError({statusCode:404,statusMessage:'Không có yêu cầu cần xử lý trong đơn vị'})
 return {ok:true}
})
