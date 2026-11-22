// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Đăng nhập công dân bằng Keycloak (client citizen-app) và gọi lõi qua cổng APISIX.
// Token Keycloak giữ trong cookie HttpOnly, mã hóa AES-256-GCM bằng khóa suy ra từ SESSION_SECRET;
// trình duyệt không đọc được token. Token truy cập hết hạn thì tự gia hạn bằng refresh token.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { getCookie, setCookie, deleteCookie, createError, type H3Event } from 'h3'
import { signOut } from './session'

const REALM = 'communeos'
const CLIENT_ID = 'citizen-app'
const ACCESS_COOKIE = 'communeos_citizen_at'
const REFRESH_COOKIE = 'communeos_citizen_rt'

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; refresh_expires_in?: number }
type Stored = { t: string; e: number }

function settings() {
  const c = useRuntimeConfig()
  return {
    keycloak: String(c.keycloakUrl || '').replace(/\/$/, ''),
    gateway: String(c.gatewayUrl || '').replace(/\/$/, ''),
    secret: String(c.sessionSecret || ''),
  }
}
const tokenUrl = () => `${settings().keycloak}/realms/${REALM}/protocol/openid-connect/token`

function key() {
  const secret = settings().secret
  if (secret.length < 32) throw createError({ statusCode: 503, statusMessage: 'SESSION_SECRET phải có ít nhất 32 ký tự' })
  return createHash('sha256').update(`citizen-token|${secret}`).digest()
}
function seal(value: Stored) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
}
function open(sealed: string | undefined): Stored | null {
  if (!sealed) return null
  try {
    const raw = Buffer.from(sealed, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
    const value = JSON.parse(text) as Stored
    return typeof value.t === 'string' && typeof value.e === 'number' ? value : null
  } catch { return null }
}

const cookieOptions = (maxAge: number) =>
  ({ httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge })

/** Đọc claim của token vừa nhận trực tiếp từ Keycloak (kênh nội bộ, không qua trình duyệt). */
export function tokenClaims(token: string): Record<string, any> {
  try { return JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) } catch { return {} }
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  let response: Response
  try {
    response = await fetch(tokenUrl(), {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body,
      redirect: 'error', signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Chưa kết nối được hệ thống định danh, vui lòng thử lại sau' })
  }
  const data = await response.json().catch(() => ({})) as TokenResponse & { error_description?: string }
  if (response.ok && data.access_token) return data
  const reason = String(data.error_description || '')
  if (/disabled/i.test(reason)) throw createError({ statusCode: 403, statusMessage: 'Tài khoản đang bị khóa' })
  if (/not fully set up/i.test(reason)) throw createError({ statusCode: 403, statusMessage: 'Tài khoản cần hoàn tất thiết lập, vui lòng liên hệ bộ phận một cửa' })
  throw createError({ statusCode: 401, statusMessage: 'Tên đăng nhập hoặc mật khẩu không đúng' })
}

/** Đổi tên đăng nhập và mật khẩu lấy token; chỉ nhận tài khoản có vai trò citizen. */
export async function passwordLogin(username: string, password: string): Promise<TokenResponse> {
  const tokens = await requestToken(new URLSearchParams({ grant_type: 'password', client_id: CLIENT_ID, username, password }))
  const roles: string[] = tokenClaims(tokens.access_token).realm_access?.roles || []
  if (!roles.includes('citizen')) throw createError({ statusCode: 403, statusMessage: 'Tài khoản này không phải tài khoản công dân' })
  return tokens
}

export function saveTokens(event: H3Event, tokens: TokenResponse) {
  setCookie(event, ACCESS_COOKIE, seal({ t: tokens.access_token, e: Date.now() + tokens.expires_in * 1000 }), cookieOptions(tokens.expires_in))
  if (tokens.refresh_token) {
    const life = tokens.refresh_expires_in || tokens.expires_in
    setCookie(event, REFRESH_COOKIE, seal({ t: tokens.refresh_token, e: Date.now() + life * 1000 }), cookieOptions(life))
  }
}

export function clearTokens(event: H3Event) {
  deleteCookie(event, ACCESS_COOKIE, { path: '/' })
  deleteCookie(event, REFRESH_COOKIE, { path: '/' })
}

/** Token truy cập còn hạn của công dân đang đăng nhập; tự gia hạn, hết phiên thì đăng xuất. */
export async function citizenAccessToken(event: H3Event, forceRefresh = false): Promise<string> {
  const access = open(getCookie(event, ACCESS_COOKIE))
  if (!forceRefresh && access && access.e - 30_000 > Date.now()) return access.t
  const refresh = open(getCookie(event, REFRESH_COOKIE))
  if (refresh && refresh.e > Date.now()) {
    try {
      const tokens = await requestToken(new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT_ID, refresh_token: refresh.t }))
      saveTokens(event, tokens)
      return tokens.access_token
    } catch { /* phiên Keycloak đã hết: đăng xuất bên dưới */ }
  }
  clearTokens(event)
  signOut(event)
  throw createError({ statusCode: 401, statusMessage: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' })
}

/** Gọi lõi qua cổng APISIX bằng một token cụ thể. */
export function gatewayFetch<T>(token: string, path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  return $fetch<T>(`${settings().gateway}${path}`, {
    method: (options.method || 'GET') as any,
    body: options.body as any,
    headers: { authorization: `Bearer ${token}` },
    timeout: 8000,
  })
}

/** Gọi lõi qua cổng APISIX thay mặt công dân đang đăng nhập; token bị từ chối thì gia hạn và thử lại một lần. */
export async function citizenGateway<T>(event: H3Event, path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  try {
    return await gatewayFetch<T>(await citizenAccessToken(event), path, options)
  } catch (error: any) {
    if (error?.statusCode === 401 && error?.statusMessage?.startsWith('Phiên')) throw error
    if (error?.status !== 401) throw error
    return gatewayFetch<T>(await citizenAccessToken(event, true), path, options)
  }
}

/** Thu hồi phiên Keycloak khi đăng xuất (lỗi mạng không chặn việc đăng xuất). */
export async function revokeTokens(event: H3Event) {
  const refresh = open(getCookie(event, REFRESH_COOKIE))
  clearTokens(event)
  if (!refresh) return
  await fetch(`${settings().keycloak}/realms/${REALM}/protocol/openid-connect/logout`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, refresh_token: refresh.t }),
    redirect: 'error', signal: AbortSignal.timeout(5000),
  }).catch(() => undefined)
}
