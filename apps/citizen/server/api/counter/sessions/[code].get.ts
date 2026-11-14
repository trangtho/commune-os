// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../../../utils/database'
import { counterCodeHash } from '../../../utils/counter-sessions'
// Public, non-identifying reference lookup. Staff authentication and identity verification
// must happen in the staff application before it can accept an official application.
export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','no-store')
  const code=(getRouterParam(event,'code') || '').toUpperCase()
  if(!/^[A-F0-9]{20}$/.test(code))throw createError({statusCode:404,statusMessage:'Phiên không hợp lệ'})
  const data=await publicQuery<{procedure_id:string;title:string;expires_at:string}>(`SELECT s.procedure_id,p.title,s.expires_at
    FROM citizen_counter_sessions s JOIN procedures p ON p.id=s.procedure_id
    WHERE s.code_hash=$1 AND s.expires_at>now() AND s.ended_at IS NULL AND p.published=true`,[counterCodeHash(code)])
  if(!data[0])throw createError({statusCode:404,statusMessage:'Mã phiên đã hết hạn hoặc không tồn tại'})
  return {procedureId:data[0].procedure_id,procedureTitle:data[0].title,expiresAt:data[0].expires_at,
    note:'Mã chỉ dùng để tham khảo thủ tục tại quầy; không chứng minh danh tính hay quyền nộp hồ sơ.'}
})
