// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { configOidc, consumeOidc, verifiedOidcSubject, oidcLoginName } from '../../../utils/oidc'
import { publicQuery, db } from '../../../utils/database'
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
  // Import residence only with explicit login consent + approved provider contract.
  // Do not persist raw ID tokens, national ID numbers, addresses or unmatched codes.
  if (flow.useResidence && c.vneid && (user.residenceTenantCode || user.temporaryTenantCode)) {
    // The response cookie is not available to readSession() until the next request.
    // Use the independently verified+linked actor and the same transaction-scoped RLS context.
    const actor={id:rows[0].id,tenantId:rows[0].tenant_id}
    const client=await db().connect()
    try{
      await client.query('BEGIN')
      await client.query('SELECT set_config($1,$2,true),set_config($3,$4,true)',
        ['app.citizen_id',actor.id,'app.tenant_id',actor.tenantId])
      const codes=[user.residenceTenantCode,user.temporaryTenantCode].filter(Boolean)
      const available=(await client.query('SELECT code,id FROM tenants WHERE code=ANY($1::text[])',[codes])).rows
      const localities=new Map(available.map(row=>[row.code,row.id]))
      const residence=user.residenceTenantCode ? localities.get(user.residenceTenantCode) || null : null
      const temporary=user.temporaryTenantCode ? localities.get(user.temporaryTenantCode) || null : null
      if (residence || temporary) await client.query(`INSERT INTO citizen_service_preferences
        (citizen_id,tenant_id,residence_tenant_id,temporary_tenant_id,locality_source,locality_verified_at)
        VALUES($1,$2,$3,$4,'oidc_verified',now())
        ON CONFLICT(citizen_id) DO UPDATE SET
          residence_tenant_id=COALESCE(EXCLUDED.residence_tenant_id,citizen_service_preferences.residence_tenant_id),
          temporary_tenant_id=COALESCE(EXCLUDED.temporary_tenant_id,citizen_service_preferences.temporary_tenant_id),
          locality_source='oidc_verified',locality_verified_at=now(),updated_at=now()`,
        [actor.id,actor.tenantId,residence,temporary])
      await client.query('COMMIT')
    }catch(error){await client.query('ROLLBACK');throw error}
    finally{client.release()}
  }
  signSession(event,{id:rows[0].id,tenantId:rows[0].tenant_id,name:rows[0].display_name,authMethod:'oidc'})
  return sendRedirect(event,flow.next,302)
})
