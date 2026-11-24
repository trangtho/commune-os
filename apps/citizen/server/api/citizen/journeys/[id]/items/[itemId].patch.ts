// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Cập nhật một bước của lộ trình, có thể gắn hồ sơ đúng thủ tục của chính mình (api.citizen_journey_item_update của lõi).
import {z} from 'zod'
import {validate} from '../../../../../utils/validation'
import {citizenRpc} from '../../../../../utils/identity'
const schema=z.object({state:z.enum(['todo','in_progress','done','skipped']),applicationId:z.string().max(90).nullable().optional()}).strict()
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 return citizenRpc(event,'citizen_journey_item_update',{p_journey_id:validate(z.string().uuid(),getRouterParam(event,'id')),
  p_item_id:validate(z.string().uuid(),getRouterParam(event,'itemId')),p_state:body.state,
  p_link:body.applicationId!==undefined,p_application_id:body.applicationId??null})
})
