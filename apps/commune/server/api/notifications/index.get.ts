// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>{
  try {
    return await staffTx(event,async(client)=>{
      const rows=(await client.query(`SELECT n.id,n.application_id,n.title,n.body,n.category,n.is_read,n.created_at FROM citizen_notifications n ORDER BY n.created_at DESC LIMIT 200`)).rows
      return rows
    })
  } catch {
    return []
  }
})
