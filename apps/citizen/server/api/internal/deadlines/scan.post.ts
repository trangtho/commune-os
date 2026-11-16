// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { db } from '../../../utils/database'
import { requireStaffBridge } from '../../../utils/staff-bridge'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 const created=(await db().query('SELECT citizen_staff_scan_deadlines($1::uuid) AS created',[staff.tenantId])).rows[0]?.created
 return {created:Number(created||0),notice:'Tác vụ phải được hệ thống lập lịch bên ngoài gọi định kỳ cho từng địa phương.'}
})
