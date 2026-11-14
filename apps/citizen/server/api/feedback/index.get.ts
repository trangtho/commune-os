// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
// RLS restricts the list to the authenticated citizen and tenant.
export default defineEventHandler(async event => citizenTx(event, async client =>
  (await client.query('SELECT id, subject, message, created_at FROM citizen_feedback ORDER BY created_at DESC, id DESC LIMIT 50')).rows
))
