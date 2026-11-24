// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Thêm công việc cần nhắc (api.citizen_reminder_create của lõi).
import {z} from 'zod'
import {validate} from '../../../utils/validation'
import {citizenRpc} from '../../../utils/identity'
const schema=z.object({title:z.string().trim().min(3).max(140),dueOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),applicationId:z.string().max(90).nullable().optional()}).strict()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 const d=new Date(input.dueOn+'T00:00:00Z')
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==input.dueOn||input.dueOn<'2000-01-01'||input.dueOn>'2100-12-31')
  throw createError({statusCode:422,statusMessage:'Ngày nhắc không hợp lệ'})
 const row=await citizenRpc(event,'citizen_reminder_create',{p_title:input.title,p_due_on:input.dueOn,p_application_id:input.applicationId||null})
 setResponseStatus(event,201)
 return row
})
