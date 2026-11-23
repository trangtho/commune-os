// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tạo mã chuyển hồ sơ tại quầy: mã ngẫu nhiên sinh ở đây và chỉ trả cho công dân; lõi chỉ lưu mã băm SHA-256
// (api.citizen_case_handoff_create). Cán bộ dùng mã qua api.redeem_citizen_handoff của lõi.
import { randomBytes, createHash } from 'node:crypto'
import { citizenRpc } from '../../../../utils/identity'
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store')
  const id=getRouterParam(event,'id')||''
  // 15 minutes: lõi đặt hạn dùng của mã.
  const code=randomBytes(24).toString('base64url').toUpperCase()
  const result=await citizenRpc<{handoffId:string;expiresAt:string;applicationId:string}>(event,'citizen_case_handoff_create',{p_application_id:id,p_code_hash:hash(code)})
  setResponseStatus(event,201)
  return {...result,code,notice:'Mã chỉ dùng tại quầy với cán bộ được xác thực; không phải mã đăng nhập hoặc giấy biên nhận.'}
})
