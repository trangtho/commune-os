// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lưu lộ trình chuẩn bị theo sự kiện cuộc sống (api.citizen_journey_create của lõi; chỉ thủ tục xã đang mở).
import {z} from 'zod'
import {validate} from '../../../utils/validation'
import {citizenRpc} from '../../../utils/identity'
const schema=z.object({title:z.string().trim().min(3).max(120),situation:z.string().trim().max(500).default(''),
 eventCode:z.enum(['birth','marriage','residence','business','loss','other']).default('other'),
 procedureIds:z.array(z.string().regex(/^[a-z0-9-]{2,80}$/)).min(1).max(6)}).strict()
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 if(new Set(body.procedureIds).size!==body.procedureIds.length)throw createError({statusCode:422,statusMessage:'Một thủ tục không thể xuất hiện hai lần'})
 const created=await citizenRpc(event,'citizen_journey_create',{p_title:body.title,p_situation:body.situation,p_event_code:body.eventCode,p_procedure_ids:body.procedureIds})
 setResponseStatus(event,201)
 return created
})
