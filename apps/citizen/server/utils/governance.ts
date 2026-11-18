// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {timingSafeEqual} from 'node:crypto'
import type {H3Event} from 'h3'
/** Separate privileged approval from routine staff bridge operations. */
export function requireGovernanceToken(event:H3Event){
 const expected=process.env.CITIZEN_GOVERNANCE_TOKEN||''
 if(expected.length<32)throw createError({statusCode:503,statusMessage:'Chưa cấu hình quyền công bố và quản trị dữ liệu'})
 const provided=getHeader(event,'x-communeos-governance-token')||''
 const a=Buffer.from(expected),b=Buffer.from(provided)
 if(a.length!==b.length||!timingSafeEqual(a,b))
  throw createError({statusCode:403,statusMessage:'Thiếu thẩm quyền công bố hoặc phê duyệt xử lý dữ liệu'})
}
