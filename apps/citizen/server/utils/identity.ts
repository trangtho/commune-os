// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Đăng nhập công dân bằng Keycloak (client bí mật citizen-app) và gọi lõi qua cổng APISIX.
// Chỉ máy chủ Kênh người dân giữ client secret, nên công dân không tự xin token để gọi thẳng API lõi.
// Token Keycloak giữ trong cookie HttpOnly, mã hóa AES-256-GCM bằng khóa suy ra từ SESSION_SECRET;
// trình duyệt không đọc được token. Token truy cập hết hạn thì tự gia hạn bằng refresh token.
import { securePortalCookie } from './cookie-policy'
import { sealToken, openToken } from './token-seal'
import { getRequestURL, getCookie, setCookie, deleteCookie, createError, type H3Event } from 'h3'
import { readSession, signOut } from './session'

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
    clientSecret: String(c.keycloakClientSecret || ''),
  }
}
const tokenUrl = () => `${settings().keycloak}/realms/${REALM}/protocol/openid-connect/token`

function seal(value: Stored) {
  if (settings().secret.length < 32) throw createError({ statusCode: 503, statusMessage: 'SESSION_SECRET phải có ít nhất 32 ký tự' })
  return sealToken(settings().secret, 'citizen-token', value)
}
function open(sealed: string | undefined) {
  return openToken(settings().secret, 'citizen-token', sealed)
}

const cookieOptions = (event: H3Event, maxAge: number) =>
  ({ httpOnly: true, sameSite: 'lax' as const, secure: securePortalCookie(getRequestURL(event, {xForwardedHost: false, xForwardedProto: false})), path: '/', maxAge })

/** Đọc claim của token vừa nhận trực tiếp từ Keycloak (kênh nội bộ, không qua trình duyệt). */
export function tokenClaims(token: string): Record<string, any> {
  try { return JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) } catch { return {} }
}

async function requestToken(body: URLSearchParams): Promise<TokenResponse> {
  const clientSecret = settings().clientSecret
  if (!clientSecret) throw createError({ statusCode: 503, statusMessage: 'Chưa cấu hình CITIZEN_KEYCLOAK_SECRET cho Kênh người dân' })
  body.set('client_secret', clientSecret)
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
  setCookie(event, ACCESS_COOKIE, seal({ t: tokens.access_token, e: Date.now() + tokens.expires_in * 1000 }), cookieOptions(event, tokens.expires_in))
  if (tokens.refresh_token) {
    const life = tokens.refresh_expires_in || tokens.expires_in
    setCookie(event, REFRESH_COOKIE, seal({ t: tokens.refresh_token, e: Date.now() + life * 1000 }), cookieOptions(event, life))
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
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: settings().clientSecret, refresh_token: refresh.t }),
    redirect: 'error', signal: AbortSignal.timeout(5000),
  }).catch(() => undefined)
}

/** Đổi lỗi từ cổng API (PostgREST, dịch vụ lõi) thành lỗi trả cho trình duyệt, không lộ chi tiết nội bộ. */
export function coreError(error: any) {
  if (error?.statusCode && !error?.status) return error
  const status = Number(error?.status) || 0
  const code = String(error?.data?.code || '')
  if (!status || status >= 500) {
    console.error('[core] Lời gọi lõi thất bại:', status || 'không kết nối được', code)
    return createError({ statusCode: 503, statusMessage: 'Chưa kết nối được máy chủ dữ liệu, vui lòng thử lại sau' })
  }
  // Lỗi nghiệp vụ của lõi có mã PTxyz và lời nhắn tiếng Việt; lỗi khác không trả nguyên văn.
  const message = code.startsWith('PT') && error?.data?.message ? String(error.data.message)
    : status === 401 ? 'Vui lòng đăng nhập tài khoản Công dân'
    : status === 403 ? 'Bạn không có quyền thực hiện thao tác này'
    : status === 404 ? 'Không tìm thấy dữ liệu'
    : 'Yêu cầu không hợp lệ'
  return createError({ statusCode: status, statusMessage: message })
}

/** Gọi một hàm API của lõi (POST /rest/rpc/<tên>) thay mặt công dân đang đăng nhập. */
export async function citizenRpc<T = any>(event: H3Event, name: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await citizenGateway<T>(event, `/rest/rpc/${name}`, { method: 'POST', body: args })
  } catch (error) { throw coreError(error) }
}

/** Gọi hàm API công khai của lõi (POST /public/rpc/<tên>), dành cho khách chưa đăng nhập. */
export async function publicRpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await $fetch<T>(`${settings().gateway}/public/rpc/${name}`, { method: 'POST', body: args, timeout: 8000 })
  } catch (error) { throw coreError(error) }
}

/** Người dân tự đăng ký (POST /public/accounts/register của lõi; cổng giới hạn số lần gọi). Lời nhắn lỗi của dịch vụ
 *  tài khoản là tiếng Việt, không chứa chi tiết nội bộ, nên trả nguyên cho người dùng. */
export async function registerCitizenAccount(body: Record<string, unknown>, clientIp: string): Promise<{ username: string; tenantCode: string; notice: string }> {
  try {
    return await $fetch(`${settings().gateway}/public/accounts/register`, {
      method: 'POST', body, timeout: 15000, headers: clientIp ? { 'x-forwarded-for': clientIp } : {},
    })
  } catch (error: any) {
    const status = Number(error?.status) || 0
    if (status === 429) throw createError({ statusCode: 429, statusMessage: 'Đăng ký quá nhiều lần, vui lòng thử lại sau ít phút' })
    if (status >= 400 && status < 500 && error?.data?.message) throw createError({ statusCode: status, statusMessage: String(error.data.message) })
    throw coreError(error)
  }
}

/** Công dân đã đăng nhập bằng Keycloak thì gọi bằng token (lọc theo xã), còn lại gọi API công khai. */
export function catalogRpc<T = any>(event: H3Event, name: string, args: Record<string, unknown> = {}): Promise<T> {
  return readSession(event)?.authMethod === 'keycloak' ? citizenRpc<T>(event, name, args) : publicRpc<T>(name, args)
}

/** Token tài khoản dịch vụ của client citizen-app (client_credentials), dùng cho việc không có công dân đăng nhập sẵn
 *  (liên kết đăng nhập OIDC bên ngoài). Lõi chỉ nhận token này ở hàm citizen_service_* (public.is_citizen_service()). */
let serviceToken: Stored | null = null
async function citizenServiceToken(): Promise<string> {
  if (serviceToken && serviceToken.e - 30_000 > Date.now()) return serviceToken.t
  const tokens = await requestToken(new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID }))
  serviceToken = { t: tokens.access_token, e: Date.now() + tokens.expires_in * 1000 }
  return serviceToken.t
}

/** Gọi một hàm citizen_service_* của lõi (POST /rest/rpc/<tên>) bằng tài khoản dịch vụ của Kênh người dân. */
export async function serviceRpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await gatewayFetch<T>(await citizenServiceToken(), `/rest/rpc/${name}`, { method: 'POST', body: args })
  } catch (error) { throw coreError(error) }
}
