// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../../utils/database'
export default defineEventHandler(event => citizenTx(event, async client=>{
  const id=getRouterParam(event,'id') || ''
  const owns=(await client.query('SELECT 1 FROM applications WHERE id=$1',[id])).rowCount
  if(!owns)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
  return {items:(await client.query(`SELECT id,stage,rating,comment,created_at
    FROM citizen_stage_reviews WHERE application_id=$1 ORDER BY created_at DESC`,[id])).rows}
}))
