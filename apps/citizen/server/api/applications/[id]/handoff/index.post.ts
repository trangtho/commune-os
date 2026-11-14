// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { randomBytes, createHash } from 'node:crypto'
import { citizenTx } from '../../../../utils/database'
const hash=(value:string)=>createHash('sha256').update(value).digest('hex')
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store')
  const id=getRouterParam(event,'id')||''
  const result=await citizenTx(event,async(client,actor)=>{
    const row=(await client.query('SELECT id,status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
    if(!row)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ của bạn'})
    if(row.status!=='draft')throw createError({statusCode:409,statusMessage:'Chỉ có thể chuyển tiếp hồ sơ đang chuẩn bị (bản nháp)'})
    const count=Number((await client.query(`SELECT count(*)::int AS n FROM citizen_case_handoffs
      WHERE application_id=$1 AND created_at>now()-interval '1 hour'`,[id])).rows[0].n)
    if(count>=5)throw createError({statusCode:429,statusMessage:'Đã tạo quá nhiều mã; hãy thử lại sau'})
    await client.query(`UPDATE citizen_case_handoffs SET revoked_at=now()
      WHERE application_id=$1 AND revoked_at IS NULL AND redeemed_at IS NULL`,[id])
    const code=randomBytes(24).toString('base64url').toUpperCase()
    const data=(await client.query(`INSERT INTO citizen_case_handoffs
      (application_id,citizen_id,tenant_id,code_hash,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '15 minutes') RETURNING id,expires_at`,
      [id,actor.id,actor.tenantId,hash(code)])).rows[0]
    return {handoffId:data.id,code,expiresAt:data.expires_at,applicationId:id}
  })
  setResponseStatus(event,201)
  return {...result,notice:'Mã chỉ dùng tại quầy với cán bộ được xác thực; không phải mã đăng nhập hoặc giấy biên nhận.'}
})
