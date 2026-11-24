// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gửi góp ý: lõi lưu góp ý và mở yêu cầu hỗ trợ để cán bộ trả lời (api.citizen_feedback_create).
import { z } from 'zod'
import { citizenRpc } from '../../utils/identity'
import { validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const body=validate(z.object({category:z.enum(['huong-dan','loi-ky-thuat','gop-y','phan-anh','khac']).default('khac'),subject:z.string().trim().min(3).max(130),message:z.string().trim().min(10).max(3000)}),await readBody(event))
  return citizenRpc(event,'citizen_feedback_create',{p_category:body.category,p_subject:body.subject,p_message:body.message})
})
