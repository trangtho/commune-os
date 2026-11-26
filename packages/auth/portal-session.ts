// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { securePortalCookie } from './cookie-policy'
import { getRequestURL, getCookie, setCookie, deleteCookie, createError, type H3Event } from 'h3'
import { sealToken, openToken } from './token-seal'

export type PortalTokens = { access_token: string; refresh_token?: string; expires_in: number; refresh_expires_in?: number }
export type PortalClaims = { sub?: string; tenant_id?: string; name?: string; preferred_username?: string; exp?: number; realm_access?: { roles?: string[] } }
export function claims(token: string): PortalClaims {
  try { return JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) } catch { return {} }
}

export function portalSession(scope: string, permitted: (info: PortalClaims) => boolean) {
  const accessName = `communeos_${scope}_at`
  const refreshName = `communeos_${scope}_rt`
  const clientId = 'commune-app'
  function settings(event: H3Event) {
    const c = useRuntimeConfig(event)
    const secret = String(c.sessionSecret || '')
    if (secret.length < 32) throw createError({statusCode: 503, statusMessage: 'SESSION_SECRET phải có ít nhất 32 ký tự'})
    return { secret, url: `${String(c.keycloakUrl).replace(/\/$/, '')}/realms/communeos/protocol/openid-connect` }
  }
  function clear(event: H3Event) {
    deleteCookie(event, accessName, {path: '/'})
    deleteCookie(event, refreshName, {path: '/'})
  }
  function save(event: H3Event, tokens: PortalTokens) {
    const {secret} = settings(event)
    if (!permitted(claims(tokens.access_token))) throw createError({statusCode: 403, statusMessage: 'Tài khoản không có quyền truy cập kênh này'})
    function put(name: string, value: string, lifetime: number) {
      const age = Math.floor(Math.min(lifetime, 12 * 3600))
      if (!Number.isFinite(age) || age <= 0) return
      const sealed = sealToken(secret, `${scope}:${name}`, {t: value, e: Date.now() + age * 1000})
      if (sealed.length > 3800) throw createError({statusCode: 503, statusMessage: 'Token định danh vượt quá giới hạn cookie'})
      setCookie(event, name, sealed, {httpOnly: true, sameSite: 'lax', secure: securePortalCookie(getRequestURL(event, {xForwardedHost: false, xForwardedProto: false})), path: '/', maxAge: age})
    }
    put(accessName, tokens.access_token, tokens.expires_in)
    if (tokens.refresh_token) put(refreshName, tokens.refresh_token, tokens.refresh_expires_in || tokens.expires_in)
  }
  async function access(event: H3Event): Promise<string> {
    const {secret, url} = settings(event)
    const at = openToken(secret, `${scope}:${accessName}`, getCookie(event, accessName))
    if (at && at.e > Date.now() + 15000 && permitted(claims(at.t))) return at.t
    const rt = openToken(secret, `${scope}:${refreshName}`, getCookie(event, refreshName))
    if (rt && rt.e > Date.now()) {
      let res: Response
      try {
        res = await fetch(`${url}/token`, {method: 'POST', body: new URLSearchParams({grant_type: 'refresh_token', client_id: clientId, refresh_token: rt.t}), redirect: 'error', signal: AbortSignal.timeout(8000)})
      } catch { throw createError({statusCode: 503, statusMessage: 'Hệ thống định danh chưa sẵn sàng'}) }
      if (res.ok) {
        const tokens = await res.json() as PortalTokens
        if (tokens.access_token && permitted(claims(tokens.access_token))) {
          save(event, tokens)
          return tokens.access_token
        }
      } else if (res.status >= 500 || res.status === 429) {
        throw createError({statusCode: 503, statusMessage: 'Hệ thống định danh chưa sẵn sàng'})
      }
    }
    clear(event)
    throw createError({statusCode: 401, statusMessage: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại'})
  }
  // One refresh per request, including parallel RPC calls from a page.
  function token(event: H3Event): Promise<string> {
    const k = `portalToken_${scope}`
    return event.context[k] ||= access(event)
  }
  async function logout(event: H3Event) {
    const {secret, url} = settings(event)
    const rt = openToken(secret, `${scope}:${refreshName}`, getCookie(event, refreshName))
    clear(event)
    if (rt) await fetch(`${url}/logout`, {method: 'POST', body: new URLSearchParams({client_id: clientId, refresh_token: rt.t}), redirect: 'error', signal: AbortSignal.timeout(5000)}).catch(() => undefined)
  }
  return {save, clear, token, logout}
}
