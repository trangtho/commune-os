// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { db } from '../../../../utils/database'
import { requireStaffBridge } from '../../../../utils/staff-bridge'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 const items=(await db().query('SELECT * FROM citizen_staff_list_transfers($1::uuid)',[staff.tenantId])).rows
 return {items}
})
