// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
import {recordPersonalDataUse} from '../../utils/privacy-events'
export default defineEventHandler(async(event)=>citizenTx(event,async(client,actor)=>{
  const profile=(await client.query(`SELECT c.id,c.tenant_id,c.display_name,c.email,c.phone,c.address,t.name AS tenant_name
    FROM citizens c JOIN tenants t ON c.tenant_id=t.id WHERE c.id=$1`,[actor.id])).rows[0]
  if(!profile)throw createError({statusCode:404,statusMessage:'Không có tài khoản Công dân'})
  await recordPersonalDataUse(client,actor,{action:'view_profile',purpose:'Xem thông tin hồ sơ cá nhân',resourceKind:'profile'})
  return profile
}))
