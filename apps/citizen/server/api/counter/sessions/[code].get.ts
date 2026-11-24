// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Public, non-identifying reference lookup (api.public_counter_session của lõi, chỉ nhận mã băm).
// Staff authentication and identity verification must happen in the staff application before it can accept an official application.
import { publicRpc } from '../../../utils/identity'
import { counterCodeHash } from '../../../utils/counter-sessions'
type Session={procedure_id:string;title:string;expires_at:string}|null
export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','no-store')
  const code=(getRouterParam(event,'code') || '').toUpperCase()
  if(!/^[A-F0-9]{20}$/.test(code))throw createError({statusCode:404,statusMessage:'Phiên không hợp lệ'})
  const data=await publicRpc<Session>('public_counter_session',{p_code_hash:counterCodeHash(code)})
  if(!data)throw createError({statusCode:404,statusMessage:'Mã phiên đã hết hạn hoặc không tồn tại'})
  return {procedureId:data.procedure_id,procedureTitle:data.title,expiresAt:data.expires_at,
    note:'Mã chỉ dùng để tham khảo thủ tục tại quầy; không chứng minh danh tính hay quyền nộp hồ sơ.'}
})
