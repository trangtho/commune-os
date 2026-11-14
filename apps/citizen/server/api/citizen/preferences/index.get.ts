// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
import { getPreferences } from '../../../utils/citizen-preferences'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  return citizenTx(event, async (client, actor) => getPreferences(client, actor.id))
})
