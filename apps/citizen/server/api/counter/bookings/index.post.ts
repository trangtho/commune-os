// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đặt một lượt tại bộ phận một cửa (api.citizen_counter_book của lõi; số thứ tự cấp trong lõi).
import { z } from 'zod'
import { validate } from '../../../utils/validation'
import { citizenRpc } from '../../../utils/identity'
const schema=z.object({slotId:z.string().uuid()})
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 const result=await citizenRpc(event,'citizen_counter_book',{p_slot_id:body.slotId})
 setResponseStatus(event,201)
 return result
})
