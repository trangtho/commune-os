// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gửi yêu cầu hỗ trợ (api.citizen_ticket_create của lõi; tối đa 20 yêu cầu mỗi 24 giờ).
import { z } from 'zod'
import { citizenRpc } from '../../utils/identity'
import { validate } from '../../utils/validation'
export const ticketSchema=z.object({
  category:z.enum(['huong-dan','loi-ky-thuat','gop-y','phan-anh','khac']),
  subject:z.string().trim().min(3).max(150),
  message:z.string().trim().min(10).max(3000),
  applicationId:z.string().trim().max(50).optional()
})
export default defineEventHandler(async event=>{
  const body=validate(ticketSchema,await readBody(event))
  const data=await citizenRpc(event,'citizen_ticket_create',{p_category:body.category,p_subject:body.subject,
    p_message:body.message,p_application_id:body.applicationId||null})
  setResponseStatus(event,201)
  return data
})
