// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {requireStaffBridge} from '../../../utils/staff-bridge'
import {requireGovernanceToken} from '../../../utils/governance'
import {db} from '../../../utils/database'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event);requireGovernanceToken(event)
 const result=await db().query('SELECT * FROM citizen_staff_friction_summary($1::uuid)',[staff.tenantId])
 return {items:result.rows,notice:'Chỉ công bố nhóm từ 5 lần ghi nhận trở lên trong 90 ngày, không chứa câu hỏi gốc, giá trị trường hoặc danh tính.'}
})
