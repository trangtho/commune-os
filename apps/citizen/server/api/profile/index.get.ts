// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(async(event)=>citizenTx(event,async(client,actor)=>{
  const profile=(await client.query(`SELECT c.id,c.display_name,c.email,c.phone,c.address,t.name AS tenant_name
    FROM citizens c JOIN tenants t ON c.tenant_id=t.id WHERE c.id=$1`,[actor.id])).rows[0]
  if(!profile)throw createError({statusCode:404,statusMessage:'Không có tài khoản Công dân'})
  return profile
}))
