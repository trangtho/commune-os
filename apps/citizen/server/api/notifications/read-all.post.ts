// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenRpc } from '../../utils/identity'
import { requireCitizen } from '../../utils/session'
export default defineEventHandler(async (event) => {
  requireCitizen(event)
  return citizenRpc(event, 'citizen_notifications_read_all')
})
