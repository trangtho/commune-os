// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineNuxtRouteMiddleware(async(to)=>{
  // Public information and login pages; account / case routes require a signed citizen session.
  const isPublic=to.path==='/' || to.path==='/dang-nhap' || to.path==='/thu-tuc' || to.path.startsWith('/thu-tuc/') || to.path==='/huong-dan' || to.path==='/tro-ly' || to.path==='/tai-quay'
  if(isPublic) return
  try {
    const fetcher=import.meta.server?useRequestFetch():$fetch
    const me=await fetcher<{authenticated:boolean}>('/api/auth/me')
    if(me.authenticated)return
  } catch {/* expired or invalid session */}
  return navigateTo(`/dang-nhap?next=${encodeURIComponent(to.fullPath)}`)
})
