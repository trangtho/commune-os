// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tạo nhóm thủ tục nộp cùng lúc (api.citizen_service_batch_create của lõi).
import { z } from 'zod'
import { citizenRpc } from '../../utils/identity'
import { validate } from '../../utils/validation'
import { phoneIssue } from '../../../shared/identity-validation'
const schema=z.object({
 title:z.string().trim().min(3).max(120),purpose:z.string().trim().max(500).default(''),
 procedureIds:z.array(z.string().regex(/^[a-z0-9-]{2,80}$/)).min(2).max(4),
 shareConsent:z.boolean().default(false),
 phone:z.string().trim().max(20).default('')
}).strict()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 if (new Set(input.procedureIds).size!==input.procedureIds.length)
  throw createError({statusCode:422,statusMessage:'Một thủ tục không được chọn nhiều lần'})
 if (input.shareConsent && phoneIssue(input.phone))
  throw createError({statusCode:422,statusMessage:'Số điện thoại dùng chung không hợp lệ'})
 const item=await citizenRpc(event,'citizen_service_batch_create',{p_title:input.title,p_purpose:input.purpose,
  p_procedure_ids:input.procedureIds,p_share_consent:input.shareConsent,p_phone:input.phone})
 setResponseStatus(event,201)
 return item
})
