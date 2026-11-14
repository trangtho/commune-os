// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(event => citizenTx(event,async client => {
  const id=getRouterParam(event,'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu đại diện'})
  const owner=(await client.query('SELECT id FROM citizen_representations WHERE id=$1',[id])).rowCount
  if (!owner)throw createError({statusCode:404,statusMessage:'Không tìm thấy quyền đại diện'})
  return (await client.query(`SELECT id,action,application_id,actor_name,created_at
     FROM citizen_representation_audit WHERE representation_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[id])).rows
}))
