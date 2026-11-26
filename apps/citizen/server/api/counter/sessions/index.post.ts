// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Mở phiên chuẩn bị tại quầy: mã ngẫu nhiên 80 bit chỉ để tham khảo, giữ trong cookie; lõi lưu mã băm
// (api.public_counter_session_start). Một trình duyệt chỉ có một phiên còn hạn 15 phút.
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { publicRpc } from '../../../utils/identity'
import { counterCodeHash,counterCookieCode,setCounterCookie } from '../../../utils/counter-sessions'
import { validate } from '../../../utils/validation'
const schema=z.object({procedureId:z.string().regex(/^[a-z0-9-]{2,80}$/)})
export default defineEventHandler(async event => {
  const body=validate(schema,await readBody(event))
  const existing=counterCookieCode(event)
  if(existing){
    const active=await publicRpc<{procedure_id:string;expires_at:string}|null>('public_counter_session',{p_code_hash:counterCodeHash(existing)})
    // Never create unlimited tickets from one browser before the 15-minute expiry.
    if(active){
      if(active.procedure_id!==body.procedureId)throw createError({statusCode:409,statusMessage:'Hãy kết thúc phiên hiện tại trước khi chọn thủ tục khác'})
      return {code:existing,procedureId:body.procedureId,expiresAt:active.expires_at}
    }
  }
  const code=randomBytes(10).toString('hex').toUpperCase() // 80 random bits: reference only, NOT proof of identity
  const result=await publicRpc<{expires_at:string}>('public_counter_session_start',{p_code_hash:counterCodeHash(code),p_procedure_id:body.procedureId})
  setCounterCookie(event,code)
  setResponseStatus(event,201)
  return {code,procedureId:body.procedureId,expiresAt:result.expires_at}
})
