// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đánh dấu công việc đã xong / chưa xong (api.citizen_reminder_complete của lõi).
import {z} from 'zod'
import {validate} from '../../../../utils/validation'
import {citizenRpc} from '../../../../utils/identity'
export default defineEventHandler(async event=>{
 const body=validate(z.object({completed:z.boolean()}).strict(),await readBody(event))
 return citizenRpc(event,'citizen_reminder_complete',{p_task_id:validate(z.string().uuid(),getRouterParam(event,'id')),p_completed:body.completed})
})
