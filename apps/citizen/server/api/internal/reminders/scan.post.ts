// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {requireStaffBridge} from '../../../utils/staff-bridge'
import {requireGovernanceToken} from '../../../utils/governance'
import {db} from '../../../utils/database'
export default defineEventHandler(async event=>{
 requireStaffBridge(event);requireGovernanceToken(event)
 if(process.env.CITIZEN_REMINDERS_ENABLED!=='true')throw createError({statusCode:503,statusMessage:'Nhắc việc tự động đang tắt'})
 const r=await db().query('SELECT citizen_dispatch_reminders($1) AS sent',[300])
 return {sent:Number(r.rows[0]?.sent||0),channel:'in_app_only'}
})
