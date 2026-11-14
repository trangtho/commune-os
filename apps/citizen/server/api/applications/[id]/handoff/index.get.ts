// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../../utils/database'
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','private, no-store')
  const id=getRouterParam(event,'id')||''
  return citizenTx(event,async(client)=>{
    if(!(await client.query('SELECT 1 FROM applications WHERE id=$1',[id])).rowCount)
      throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
    return (await client.query(`SELECT id AS "handoffId",expires_at AS "expiresAt",created_at AS "createdAt",
      revoked_at AS "revokedAt",redeemed_at AS "redeemedAt",redeemed_by AS "redeemedBy"
      FROM citizen_case_handoffs WHERE application_id=$1 ORDER BY created_at DESC LIMIT 8`,[id])).rows
  })
})
