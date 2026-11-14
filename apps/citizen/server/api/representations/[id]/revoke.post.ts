// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(event => citizenTx(event,async client => {
  const id = getRouterParam(event,'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw createError({statusCode:400,statusMessage:'Mã quyền đại diện không hợp lệ'})
  const result = await client.query('SELECT citizen_revoke_own_representation($1) AS revoked',[id])
  if (!result.rows[0]?.revoked) throw createError({statusCode:404,statusMessage:'Quyền đại diện không tồn tại hoặc đã thu hồi'})
  return {revoked:true}
}))
