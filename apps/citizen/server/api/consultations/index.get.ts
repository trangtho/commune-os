// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(event => citizenTx(event, async client => ({
  items:(await client.query(`SELECT id,category,subject,description,channel,contact_phone,
    preferred_at,slot_id,status,meeting_url,staff_note,created_at,updated_at
    FROM citizen_consultation_requests ORDER BY created_at DESC LIMIT 50`)).rows
})))
