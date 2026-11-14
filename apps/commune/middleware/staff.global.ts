// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineNuxtRouteMiddleware(async(to)=>{
  // Public: login page. Everything else requires a signed staff session.
  const isPublic=to.path==='/dang-nhap'
  if(isPublic) return
  try {
    const fetcher=import.meta.server?useRequestFetch():$fetch
    const me=await fetcher<{authenticated:boolean;role?:string}>('/api/auth/me')
    if(me.authenticated && (me.role==='officer'||me.role==='admin')) return
  } catch {/* expired or invalid session */}
  return navigateTo(`/dang-nhap?next=${encodeURIComponent(to.fullPath)}`)
})
