// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Kết thúc phiên chuẩn bị tại quầy (api.public_counter_session_end của lõi).
import { publicRpc } from '../../../utils/identity'
import { counterCodeHash,counterCookieCode,clearCounterCookie } from '../../../utils/counter-sessions'
export default defineEventHandler(async event => {
  const code=counterCookieCode(event)
  if(code)await publicRpc('public_counter_session_end',{p_code_hash:counterCodeHash(code)})
  clearCounterCookie(event)
  return {ended:true}
})
