// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { db } from '../../../../utils/database'
import { requireStaffBridge } from '../../../../utils/staff-bridge'
export default defineEventHandler(async event=>{
  const staff=requireStaffBridge(event)
  const items=(await db().query('SELECT citizen_staff_support_tickets($1::uuid,$2::int) AS items',
    [staff.tenantId,50])).rows[0]?.items||[]
  return {items}
})
