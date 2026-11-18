// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {citizenTx} from '../../../utils/database'
import {validate} from '../../../utils/validation'
import {recordPersonalDataUse} from '../../../utils/privacy-events'
const schema=z.object({targetTenantId:z.string().uuid(),confirmed:z.literal(true),
 categories:z.array(z.enum(['display_name','phone','address'])).min(1).max(3)}).strict()
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 const data=validate(schema,await readBody(event))
 if(data.targetTenantId===actor.tenantId)throw createError({statusCode:400,statusMessage:'Địa phương nhận phải khác địa phương hiện tại'})
 const found=await client.query('SELECT 1 FROM tenants WHERE id=$1',[data.targetTenantId])
 if(!found.rowCount)throw createError({statusCode:400,statusMessage:'Địa phương nhận không được hỗ trợ'})
 const citizen=(await client.query('SELECT display_name,phone,address FROM citizens WHERE id=$1',[actor.id])).rows[0]
 if(!citizen)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ cá nhân'})
 const payload:Object=Object.fromEntries(data.categories.map(key=>[key,citizen[key]||'']))
 const result=(await client.query(`INSERT INTO citizen_sync_requests(citizen_id,source_tenant_id,target_tenant_id,payload)
 VALUES($1,$2,$3,$4::jsonb) RETURNING id,state,created_at`,
 [actor.id,actor.tenantId,data.targetTenantId,JSON.stringify(payload)])).rows[0]
 await recordPersonalDataUse(client,actor,{action:'share_case',purpose:'Yêu cầu chuyển dữ liệu tự khai sang địa phương khác',resourceKind:'sync_request',resourceReference:result.id})
 setResponseStatus(event,201)
 return {...result,notice:'Đã tạo yêu cầu đồng bộ có xác nhận. Đơn vị nhận chỉ có thể xem qua API được cấp quyền; không tự ghi đè.'}
}))
