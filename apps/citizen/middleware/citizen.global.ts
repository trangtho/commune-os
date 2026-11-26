// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineNuxtRouteMiddleware(async(to)=>{
  // Public information and login pages; account / case routes require a signed citizen session.
  const isPublic=to.path==='/kiem-chung-ket-qua' || to.path==='/tim-theo-tinh-huong' || to.path==='/goi-y-thu-tuc' || to.path==='/' || to.path==='/dang-nhap' || to.path==='/dang-ky' || to.path==='/thu-tuc' || to.path.startsWith('/thu-tuc/') || to.path==='/huong-dan' || to.path==='/tro-ly' || to.path==='/tai-quay'
  if(isPublic) return
  try {
    const fetcher=import.meta.server?useRequestFetch():$fetch
    const me=await fetcher<{authenticated:boolean}>('/api/auth/me', {
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
      credentials: 'same-origin'
    })
    if(me.authenticated)return
  } catch (error: any) {
    const status = error?.statusCode ?? error?.response?.status
    if (status !== 401 && status !== 403) throw createError({statusCode: 503, statusMessage: 'Chưa kiểm tra được phiên đăng nhập, vui lòng tải lại trang'})
  }
  return navigateTo(`/dang-nhap?next=${encodeURIComponent(to.fullPath)}`)
})
