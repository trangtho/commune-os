// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { validate } from '../../../utils/validation'
import { citizenTx } from '../../../utils/database'
const schema=z.object({slotId:z.string().uuid()})
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 const result=await citizenTx(event,async client=>{
  const row=(await client.query('SELECT citizen_book_counter_slot($1) AS booked',[body.slotId])).rows[0]
  return row.booked
 })
 setResponseStatus(event,201)
 return result
})
