// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đổi trạng thái lộ trình (api.citizen_journey_status của lõi).
import {z} from 'zod'
import {validate} from '../../../../utils/validation'
import {citizenRpc} from '../../../../utils/identity'
const schema=z.object({status:z.enum(['active','completed','archived'])}).strict()
export default defineEventHandler(async event=>{
 const {status}=validate(schema,await readBody(event))
 return citizenRpc(event,'citizen_journey_status',{p_journey_id:validate(z.string().uuid(),getRouterParam(event,'id')),p_status:status})
})
