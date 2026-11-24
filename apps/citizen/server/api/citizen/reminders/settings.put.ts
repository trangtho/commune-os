// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Bật / tắt nhắc việc trong ứng dụng (api.citizen_reminder_settings_save của lõi).
import {z} from 'zod'
import {validate} from '../../../utils/validation'
import {citizenRpc} from '../../../utils/identity'
const schema=z.object({enabled:z.boolean(),daysBefore:z.number().int().min(0).max(14)}).strict()
export default defineEventHandler(async event=>{
 const input=validate(schema,await readBody(event))
 return citizenRpc(event,'citizen_reminder_settings_save',{p_enabled:input.enabled,p_days_before:input.daysBefore})
})
