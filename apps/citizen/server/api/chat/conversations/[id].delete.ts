// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'

export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  const id = getRouterParam(event, 'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw createError({ statusCode: 400, statusMessage: 'Mã hội thoại không hợp lệ' })
  return citizenTx(event, async client => {
    const deleted = await client.query('DELETE FROM citizen_ai_conversations WHERE id = $1 RETURNING id', [id])
    if (!deleted.rowCount) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy hội thoại cần xóa' })
    return { ok: true }
  })
})
