// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../../utils/database'
import {z} from 'zod'
import {validate} from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const body=validate(z.object({completed:z.boolean()}).strict(),await readBody(event))
 return citizenTx(event,async client=>{
  const id=String(getRouterParam(event,'id')||'')
  const r=await client.query('UPDATE citizen_personal_tasks SET completed_at=$1 WHERE id=$2 RETURNING id,completed_at',[body.completed?new Date():null,id])
  if(!r.rowCount)throw createError({statusCode:404,statusMessage:'Không tìm thấy công việc'})
  return r.rows[0]
 })
})
