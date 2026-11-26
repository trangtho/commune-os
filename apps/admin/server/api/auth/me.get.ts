// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { adminSession } from '../../utils/session'
import { claims } from '../../utils/portal-session'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    const info = claims(await adminSession.token(event))
    return {authenticated: true, username: info.preferred_username || info.name || '', isSysAdmin: true}
  } catch (e: any) {
    if (e?.statusCode === 401) return {authenticated: false, username: '', isSysAdmin: false}
    throw e
  }
})
