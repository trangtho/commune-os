// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { deleteCookie, type H3Event } from 'h3'
import { claims, portalSession, type PortalTokens } from './portal-session'
const cookieName = 'communeos_staff_demo' // remove legacy signed, unencrypted token cookie
const session = portalSession('staff', info => Boolean(info.sub && info.tenant_id && info.realm_access?.roles?.some(r => ['receptionist','officer','leader'].includes(r))))
export function signSession(event: H3Event, tokens: PortalTokens) {
  deleteCookie(event, cookieName, {path: '/'})
  session.save(event, tokens)
}
export async function requireStaff(event: H3Event) {
  const token = await session.token(event)
  const info = claims(token)
  return {id: info.sub!, tenantId: info.tenant_id!, name: info.name || info.preferred_username || 'Cán bộ', role: info.realm_access?.roles?.includes('leader') ? 'admin' : 'officer', token}
}
export async function readSession(event: H3Event) {
  try { return await requireStaff(event) } catch (e: any) { if (e?.statusCode === 401) return null; throw e }
}
export function signOut(event: H3Event) { session.clear(event); deleteCookie(event, cookieName, {path: '/'}) }
export async function logoutStaff(event: H3Event) { await session.logout(event); signOut(event) }
