// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { publicQuery } from '../../../utils/database'
import { counterCodeHash,counterCookieCode,counterTTLSeconds,setCounterCookie } from '../../../utils/counter-sessions'
import { validate } from '../../../utils/validation'
const schema=z.object({procedureId:z.string().regex(/^[a-z0-9-]{2,80}$/)})
export default defineEventHandler(async event => {
  const body=validate(schema,await readBody(event))
  const existing=counterCookieCode(event)
  if(existing){
    const active=await publicQuery<{procedure_id:string;expires_at:string}>(`SELECT procedure_id,expires_at FROM citizen_counter_sessions
      WHERE code_hash=$1 AND expires_at>now() AND ended_at IS NULL`,[counterCodeHash(existing)])
    // Never create unlimited tickets from one browser before the 15-minute expiry.
    if(active[0]){
      if(active[0].procedure_id!==body.procedureId)throw createError({statusCode:409,statusMessage:'Hãy kết thúc phiên hiện tại trước khi chọn thủ tục khác'})
      return {code:existing,procedureId:body.procedureId,expiresAt:active[0].expires_at}
    }
  }
  const exists=await publicQuery('SELECT 1 FROM procedures WHERE id=$1 AND published=true',[body.procedureId])
  if(!exists.length)throw createError({statusCode:404,statusMessage:'Thủ tục không được công bố'})
  const code=randomBytes(10).toString('hex').toUpperCase() // 80 random bits: reference only, NOT proof of identity
  const result=await publicQuery<{expires_at:string}>(`INSERT INTO citizen_counter_sessions(code_hash,procedure_id,expires_at)
    VALUES ($1,$2,now()+interval '15 minutes') RETURNING expires_at`,[counterCodeHash(code),body.procedureId])
  setCounterCookie(event,code)
  setResponseStatus(event,201)
  return {code,procedureId:body.procedureId,expiresAt:result[0].expires_at}
})
