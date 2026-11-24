// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Hủy yêu cầu đồng bộ còn chờ (api.citizen_sync_cancel của lõi).
import {z} from 'zod'
import {citizenRpc} from '../../../../utils/identity'
import {validate} from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const body=await readBody(event)
 if(body?.confirmed!==true)throw createError({statusCode:400,statusMessage:'Cần xác nhận hủy yêu cầu'})
 return citizenRpc(event,'citizen_sync_cancel',{p_request_id:validate(z.string().uuid(),getRouterParam(event,'id'))})
})
