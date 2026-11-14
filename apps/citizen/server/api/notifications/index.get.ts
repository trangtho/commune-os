// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
export default defineEventHandler(async(event)=>citizenTx(event,async(client)=>(await client.query('SELECT * FROM citizen_notifications ORDER BY created_at DESC LIMIT 100')).rows))
