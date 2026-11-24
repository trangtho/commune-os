// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lưu bước đang soạn của bản nháp (api.citizen_draft_cursor_save của lõi).
import {citizenRpc} from '../../../utils/identity'
import {validate} from '../../../utils/validation'
import {z} from 'zod'
const schema=z.object({step:z.number().int().min(1).max(3)}).strict()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 return citizenRpc(event,'citizen_draft_cursor_save',{p_application_id:String(getRouterParam(event,'id')||''),p_step:input.step})
})
