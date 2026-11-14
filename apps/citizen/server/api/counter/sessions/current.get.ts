// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../../../utils/database'
import { counterCodeHash,counterCookieCode,clearCounterCookie } from '../../../utils/counter-sessions'
export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','no-store')
  const code=counterCookieCode(event)
  if(!code)return {active:false}
  const rows=await publicQuery<{procedure_id:string;expires_at:string;title:string}>(`SELECT s.procedure_id,s.expires_at,p.title
    FROM citizen_counter_sessions s JOIN procedures p ON p.id=s.procedure_id
    WHERE s.code_hash=$1 AND s.expires_at>now() AND s.ended_at IS NULL`,[counterCodeHash(code)])
  if(!rows.length){clearCounterCookie(event);return {active:false}}
  return {active:true,code,procedureId:rows[0].procedure_id,procedureTitle:rows[0].title,expiresAt:rows[0].expires_at}
})
