// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffSchema,validate } from '../../utils/validation'
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>staffTx(event,async(client,actor)=>{
  const body=validate(staffSchema,await readBody(event))
  const existing=(await client.query('SELECT id FROM staff WHERE username=$1',[body.username])).rows[0]
  if(existing)throw createError({statusCode:409,statusMessage:'Tên đăng nhập đã tồn tại'})
  const id=`staff-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await client.query(`INSERT INTO staff(id,username,display_name,role,tenant_id,is_active,created_at) VALUES($1,$2,$3,$4,$5,true,now())`,
    [id,body.username,body.display_name,body.role,actor.tenantId])
  return {id,username:body.username,display_name:body.display_name,role:body.role,is_active:true}
}))
