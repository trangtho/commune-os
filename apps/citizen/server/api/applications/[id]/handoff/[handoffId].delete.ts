// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../../utils/database'
export default defineEventHandler(async event=>citizenTx(event,async(client)=>{
  const id=getRouterParam(event,'id')||''
  const handoffId=getRouterParam(event,'handoffId')||''
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handoffId))throw createError({statusCode:400,statusMessage:'Mã định danh không hợp lệ'})
  const row=(await client.query(`UPDATE citizen_case_handoffs SET revoked_at=now()
    WHERE id=$1 AND application_id=$2 AND revoked_at IS NULL AND redeemed_at IS NULL
    RETURNING id`,[handoffId,id])).rows[0]
  if(!row)throw createError({statusCode:409,statusMessage:'Mã không còn hiệu lực hoặc đã được tiếp nhận'})
  return {ok:true}
}))
