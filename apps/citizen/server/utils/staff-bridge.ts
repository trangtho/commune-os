// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { z } from 'zod'
import { validate } from './validation'

/** Only trusted server-to-server callers; the citizen browser must never receive this token. */
export function requireStaffBridge(event:H3Event){
  const configured=String(useRuntimeConfig().staffBridgeToken || '')
  if(configured.length<32)throw createError({statusCode:503,statusMessage:'Kênh tích hợp cán bộ chưa được cấu hình'})
  const supplied=(getHeader(event,'authorization')||'').match(/^Bearer (\S+)$/i)?.[1]||''
  const a=Buffer.from(supplied);const b=Buffer.from(configured)
  if(a.length!==b.length||!timingSafeEqual(a,b))throw createError({statusCode:401,statusMessage:'Không có quyền truy cập dịch vụ cán bộ'})
  // Tenant and staff ID must be bound to an authenticated session by the staff backend.
  const identity=validate(z.object({tenantId:z.string().uuid(),staffId:z.string().trim().min(2).max(100)}),{
    tenantId:getHeader(event,'x-communeos-tenant-id'),staffId:getHeader(event,'x-communeos-staff-id')
  })
  setHeader(event,'Cache-Control','no-store')
  return identity
}
