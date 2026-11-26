// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gửi đề nghị về dữ liệu cá nhân (api.citizen_privacy_request_create của lõi; lãnh đạo xã xử lý).
import {z} from 'zod'
import {citizenRpc} from '../../../../utils/identity'
import {validate} from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const body=validate(z.object({requestType:z.enum(['access','correct','restrict','erase','retention_review']),
  details:z.string().trim().min(10).max(2000)}).strict(),await readBody(event))
 const row=await citizenRpc(event,'citizen_privacy_request_create',{p_request_type:body.requestType,p_details:body.details})
 setResponseStatus(event,201)
 return row
})
