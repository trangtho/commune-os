// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../../../utils/database'
import { counterCodeHash,counterCookieCode,clearCounterCookie } from '../../../utils/counter-sessions'
export default defineEventHandler(async event => {
  const code=counterCookieCode(event)
  if(code)await publicQuery('UPDATE citizen_counter_sessions SET ended_at=now() WHERE code_hash=$1 AND ended_at IS NULL',[counterCodeHash(code)])
  clearCounterCookie(event)
  return {ended:true}
})
