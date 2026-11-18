// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {requireStaffBridge} from '../../../utils/staff-bridge'
import {requireGovernanceToken} from '../../../utils/governance'
import {db} from '../../../utils/database'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event);requireGovernanceToken(event)
 const rows=await db().query('SELECT * FROM citizen_staff_sync_queue($1)',[staff.tenantId])
 setResponseHeader(event,'cache-control','private, no-store')
 return {items:rows.rows,notice:'Dữ liệu do công dân tự khai và cho phép chuyển. Cần kiểm tra nguồn và giải quyết xung đột ngoài hệ thống trước khi cập nhật.'}
})
