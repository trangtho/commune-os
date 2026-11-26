// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { appendResponseHeader } from 'h3'

export default defineNuxtRouteMiddleware(async(to)=>{
  // Public: login page. Everything else requires a signed staff session.
  if(to.path==='/dang-nhap') return
  try {
    const request = import.meta.server ? useRequestEvent() : undefined
    // Nitro's request-scoped fetch is callable but need not implement .raw().
    // Use the global ofetch instance and explicitly forward cookies only to our fixed local API.
    const response = await $fetch.raw<{authenticated:boolean;role?:string}>('/api/auth/me', {
      headers: import.meta.server ? useRequestHeaders(['cookie', 'host']) : undefined,
      credentials: 'same-origin',
      retry: 0
    })
    if (import.meta.server && request) {
      const cookies = response.headers.getSetCookie?.() ?? (response.headers.get('set-cookie')?.split(/,(?=\s*[^;,=\s]+=[^;,]*)/) || [])
      for (const cookie of cookies) appendResponseHeader(request, 'set-cookie', cookie.trim())
    }
    const me=response._data || {authenticated:false}
    if(me.authenticated && (me.role==='officer'||me.role==='admin')) return
  } catch (error: any) {
    const status = error?.statusCode ?? error?.response?.status
    if (status !== 401 && status !== 403) {
      // Avoid logging credentials, token-bearing headers or full fetch errors.
      if (import.meta.server) console.warn('[staff-auth] Session check failed', {status: typeof status === 'number' ? status : 'unknown', type: error?.name === 'TypeError' ? 'TypeError' : 'request-error'})
      throw createError({statusCode: 503, message: 'Chưa kiểm tra được phiên đăng nhập, vui lòng tải lại trang'})
    }
  }
  return navigateTo(`/dang-nhap?next=${encodeURIComponent(to.fullPath)}`)
})
