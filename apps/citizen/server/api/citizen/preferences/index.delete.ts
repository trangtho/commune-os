// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  return citizenTx(event, async (client, actor) => {
    await client.query('DELETE FROM citizen_service_preferences WHERE citizen_id=$1', [actor.id])
    return { ok: true }
  })
})
