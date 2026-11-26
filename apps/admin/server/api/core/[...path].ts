// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Same-origin BFF: the browser never receives the Keycloak bearer token.
import { adminSession } from '../../utils/session'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  const path = getRouterParam(event, 'path') || ''
  const parts = path.split('/')
  if (!['rest','accounts','workflow','files','ai'].includes(parts[0]) || parts.length < 2 || parts.some(p => !/^[a-zA-Z0-9_.-]+$/.test(p) || p === '.' || p === '..')) {
    throw createError({statusCode: 404, statusMessage: 'API lõi không tồn tại'})
  }
  const method = getMethod(event)
  if (method !== 'GET' && method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') throw createError({statusCode: 405})
  const token = await adminSession.token(event)
  const {gatewayUrl} = useRuntimeConfig(event)
  const body = method === 'GET' ? undefined : await readBody(event)
  try {
    return await $fetch(`${gatewayUrl}/${path}${getRequestURL(event).search}`, {method, body, headers: {Authorization: `Bearer ${token}`}, timeout: 15000, retry: 0, redirect: 'error'})
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 401) adminSession.clear(event)
    if ([400,401,403,404,409,422,429,503].includes(status)) throw createError({statusCode: status, statusMessage: 'API lõi từ chối yêu cầu', data: {message: status >= 500 ? 'Dịch vụ lõi chưa sẵn sàng' : String(e?.data?.message || 'Yêu cầu không hợp lệ')}})
    throw createError({statusCode: 502, statusMessage: 'Không kết nối được API lõi'})
  }
})
