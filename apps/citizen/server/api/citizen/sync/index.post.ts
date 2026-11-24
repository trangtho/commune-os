// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Yêu cầu chuyển thông tin tự khai sang địa phương khác (api.citizen_sync_create của lõi; lãnh đạo xã nhận xem xét).
import {z} from 'zod'
import {citizenRpc} from '../../../utils/identity'
import {validate} from '../../../utils/validation'
const schema=z.object({targetTenantId:z.string().uuid(),confirmed:z.literal(true),
 categories:z.array(z.enum(['display_name','phone','address'])).min(1).max(3)}).strict()
export default defineEventHandler(async event=>{
 const data=validate(schema,await readBody(event))
 const result=await citizenRpc(event,'citizen_sync_create',{p_target_tenant_id:data.targetTenantId,p_categories:data.categories})
 setResponseStatus(event,201)
 return result
})
