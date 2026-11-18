// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {requireStaffBridge} from '../../../utils/staff-bridge'
import {requireGovernanceToken} from '../../../utils/governance'
import {db} from '../../../utils/database'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event);requireGovernanceToken(event)
 const result=await db().query('SELECT * FROM citizen_staff_unanswered_summary($1)',[staff.tenantId])
 return {items:result.rows,notice:'Chỉ nhóm chủ đề có ít nhất 5 lượt hỏi chưa trả lời trong 90 ngày. Không lưu văn bản gốc hoặc danh tính công dân trong báo cáo.'}
})
