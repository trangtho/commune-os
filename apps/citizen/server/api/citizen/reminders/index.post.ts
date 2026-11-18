// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {validate} from '../../../utils/validation'
import {citizenTx} from '../../../utils/database'
const schema=z.object({title:z.string().trim().min(3).max(140),dueOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),applicationId:z.string().max(90).nullable().optional()}).strict()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 const d=new Date(input.dueOn+'T00:00:00Z')
 if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==input.dueOn||input.dueOn<'2000-01-01'||input.dueOn>'2100-12-31')
  throw createError({statusCode:422,statusMessage:'Ngày nhắc không hợp lệ'})
 return citizenTx(event,async(client,actor)=>{
  if(input.applicationId && !(await client.query('SELECT 1 FROM applications WHERE id=$1',[input.applicationId])).rowCount)
   throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ của bạn'})
  const result=await client.query(`INSERT INTO citizen_personal_tasks(citizen_id,tenant_id,title,due_on,application_id)
  VALUES($1,$2,$3,$4,$5) RETURNING id,title,due_on`,[actor.id,actor.tenantId,input.title,input.dueOn,input.applicationId||null])
  setResponseStatus(event,201)
  return result.rows[0]
 })
})
