// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {db} from '../../../../../utils/database'
import {requireStaffBridge} from '../../../../../utils/staff-bridge'
import {requireGovernanceToken} from '../../../../../utils/governance'
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 requireGovernanceToken(event)
 const result=await db().query('SELECT * FROM citizen_staff_retention_queue($1::uuid)',[staff.tenantId])
 return {items:result.rows}
})
