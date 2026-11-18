// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {validate} from '../../../../utils/validation'
import {citizenTx} from '../../../../utils/database'
const schema=z.object({status:z.enum(['active','completed','archived'])}).strict()
export default defineEventHandler(async event=>{
 const {status}=validate(schema,await readBody(event))
 return citizenTx(event,async client=>{
  const id=String(getRouterParam(event,'id')||'')
  const {rowCount}=await client.query(`UPDATE citizen_life_journeys SET status=$1,updated_at=now() WHERE id=$2`,[status,id])
  if(!rowCount)throw createError({statusCode:404,statusMessage:'Không tìm thấy lộ trình'})
  return {id,status}
 })
})
