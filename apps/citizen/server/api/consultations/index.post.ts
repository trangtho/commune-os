// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đặt lịch tư vấn: kiểm tra dữ liệu ở đây, lõi kiểm tra lại thời gian, giới hạn 3 lịch, lĩnh vực và khung giờ
// trong cùng giao dịch với lệnh ghi (api.citizen_consultation_create).
import { z } from 'zod'
import { citizenRpc } from '../../utils/identity'
import { validate } from '../../utils/validation'
import { phoneIssue } from '../../../shared/identity-validation'
const schema = z.object({
  category:z.string().trim().min(2).max(80),
  subject:z.string().trim().min(5).max(150),
  description:z.string().trim().min(10).max(2000),
  channel:z.enum(['phone','online']),
  contactPhone:z.string().trim().min(9).max(15).refine(v=>!phoneIssue(v),'Số điện thoại không hợp lệ'),
  // ISO 8601 with +07:00 offset, or a published slot provides its own timestamp.
  preferredAt:z.string().datetime({offset:true}),
  slotId:z.string().uuid().nullable().optional()
})
export default defineEventHandler(async event => {
  const body=validate(schema,await readBody(event))
  const chosen=new Date(body.preferredAt)
  const offset=chosen.valueOf()-Date.now()
  if (!Number.isFinite(offset) || offset<60*60*1000 || offset>31*24*60*60*1000)
    throw createError({statusCode:422,statusMessage:'Vui lòng chọn thời gian từ 1 giờ đến 31 ngày tới'})
  const result=await citizenRpc<Record<string,unknown>>(event,'citizen_consultation_create',{p_category:body.category,p_subject:body.subject,
    p_description:body.description,p_channel:body.channel,p_contact_phone:body.contactPhone,p_preferred_at:chosen.toISOString(),p_slot_id:body.slotId||null})
  setResponseStatus(event,201)
  return {...result,message:'Đã gửi yêu cầu; lịch hẹn chưa được cán bộ xác nhận.'}
})
