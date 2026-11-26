// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Phiên chuẩn bị tại quầy của trình duyệt này (mã trong cookie httpOnly; lõi chỉ nhận mã băm).
import { publicRpc } from '../../../utils/identity'
import { counterCodeHash,counterCookieCode,clearCounterCookie } from '../../../utils/counter-sessions'
export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','no-store')
  const code=counterCookieCode(event)
  if(!code)return {active:false}
  const s=await publicRpc<{procedure_id:string;title:string;expires_at:string}|null>('public_counter_session',{p_code_hash:counterCodeHash(code)})
  if(!s){clearCounterCookie(event);return {active:false}}
  return {active:true,code,procedureId:s.procedure_id,procedureTitle:s.title,expiresAt:s.expires_at}
})
