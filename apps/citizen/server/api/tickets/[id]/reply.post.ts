// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Công dân trả lời trong yêu cầu hỗ trợ (api.citizen_ticket_reply → citizen_reply_support_ticket của lõi).
import { z } from 'zod'
import { citizenRpc } from '../../../utils/identity'
import { validate } from '../../../utils/validation'
export default defineEventHandler(async event=>{
  const id=getRouterParam(event,'id')||''
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã định danh không hợp lệ'})
  const {message}=validate(z.object({message:z.string().trim().min(5).max(3000)}),await readBody(event))
  return citizenRpc(event,'citizen_ticket_reply',{p_ticket_id:id,p_message:message})
})
