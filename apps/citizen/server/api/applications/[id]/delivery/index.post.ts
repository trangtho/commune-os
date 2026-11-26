// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Chọn phương thức nhận kết quả (api.citizen_case_delivery_select của lõi).
import { z } from 'zod'
import { citizenRpc } from '../../../../utils/identity'
import { validate } from '../../../../utils/validation'
const schema=z.object({method:z.enum(['online','counter','postal']),deliveryAddress:z.string().trim().max(500).default(''),
 contactPhone:z.string().trim().max(20).default('')})
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 return citizenRpc(event,'citizen_case_delivery_select',{p_application_id:String(getRouterParam(event,'id')||''),
  p_method:body.method,p_delivery_address:body.deliveryAddress,p_contact_phone:body.contactPhone})
})
