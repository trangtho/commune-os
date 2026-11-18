// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {db} from '../../../../utils/database'
import {requireStaffBridge} from '../../../../utils/staff-bridge'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 const result=(await db().query('SELECT citizen_staff_scan_retention($1::uuid) AS created',[staff.tenantId])).rows[0]
 return {created:Number(result?.created||0),notice:'Hệ thống vận hành phải lên lịch gọi endpoint định kỳ; dữ liệu chỉ được đánh dấu xem xét, chưa tự tiêu hủy.'}
})
