// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { configOidc, consumeOidc, verifiedOidcSubject, oidcLoginName } from '../../../utils/oidc'
import { publicQuery } from '../../../utils/database'
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
  const user=await verifiedOidcSubject(tokens.id_token,flow.nonce)
  const login=oidcLoginName(user.iss,user.sub)
  const rows=await publicQuery<{id:string;tenant_id:string;display_name:string}>('SELECT id,tenant_id,display_name FROM citizen_login_lookup($1)',[login])
  if(!rows[0])throw createError({statusCode:403,statusMessage:'Định danh đã xác thực nhưng chưa được liên kết tài khoản Công dân. Liên hệ quản trị viên Identity.'})
  signSession(event,{id:rows[0].id,tenantId:rows[0].tenant_id,name:rows[0].display_name})
  return sendRedirect(event,flow.next,302)
})
