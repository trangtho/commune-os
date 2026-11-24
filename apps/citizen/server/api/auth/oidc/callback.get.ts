// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { configOidc, consumeOidc, verifiedOidcSubject, oidcLoginName } from '../../../utils/oidc'
import { serviceRpc } from '../../../utils/identity'
import { signSession } from '../../../utils/session'
export default defineEventHandler(async event => {
  const flow=consumeOidc(event)
  const q=getQuery(event)
  if(typeof q.code!=='string'||typeof q.state!=='string'||q.state!==flow.state||q.error)
    throw createError({statusCode:401,statusMessage:'Đăng nhập định danh bị hủy hoặc không hợp lệ'})
  const c=configOidc()
  if(!c.configured)throw createError({statusCode:503,statusMessage:'OIDC chưa cấu hình'})
  const body=new URLSearchParams({grant_type:'authorization_code',code:q.code,redirect_uri:c.redirectUri,client_id:c.clientId,code_verifier:flow.verifier})
  if(c.clientSecret)body.set('client_secret',c.clientSecret)
  const response=await fetch(c.tokenUrl,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(8000)})
  if(!response.ok)throw createError({statusCode:401,statusMessage:'Máy chủ Identity từ chối xác thực'})
  const tokens=await response.json() as {id_token?:string}
  if(!tokens.id_token)throw createError({statusCode:401,statusMessage:'Identity không trả về ID token'})
  const user=await verifiedOidcSubject(tokens.id_token,flow.nonce,Boolean(flow.usePersonalData))
  const login=oidcLoginName(user.iss,user.sub)
  // Lõi tra tài khoản công dân đã liên kết, ghi địa phương cư trú (chỉ khi công dân đồng ý và nhà cung cấp được phê duyệt)
  // và thông tin đã xác minh (chỉ khi đồng ý nhập dữ liệu cá nhân) trong một giao dịch, bằng tài khoản dịch vụ của Kênh
  // người dân (api.citizen_service_oidc_link). Do not persist raw ID tokens, national ID numbers, addresses or unmatched codes.
  const importResidence = Boolean(flow.useResidence && c.vneid)
  const linked = await serviceRpc<{id:string;tenant_id:string;display_name:string}>('citizen_service_oidc_link', {
    p_login: login, p_issuer: user.iss,
    p_residence_code: importResidence ? user.residenceTenantCode || null : null,
    p_temporary_code: importResidence ? user.temporaryTenantCode || null : null,
    p_facts: flow.usePersonalData && c.verifiedFacts ? user.personalFacts : {},
  })
  const rows = [linked]
  signSession(event,{id:rows[0].id,tenantId:rows[0].tenant_id,name:rows[0].display_name,authMethod:'oidc'})
  return sendRedirect(event,flow.next,302)
})
