// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gửi tin nhắn hỗ trợ, có thể gắn với một hồ sơ của chính mình (api.citizen_support_message_create của lõi).
import { z } from 'zod'
import { citizenRpc } from '../../utils/identity'
import { validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const b=validate(z.object({applicationId:z.string().max(50).optional(),message:z.string().trim().min(5).max(2000)}),await readBody(event))
  return citizenRpc(event,'citizen_support_message_create',{p_application_id:b.applicationId||null,p_message:b.message})
})
