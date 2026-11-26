// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đồng ý / rút đồng ý cho một mục đích xử lý dữ liệu (api.citizen_consent_decide của lõi; khóa tư vấn, ghi nhật ký).
import {z} from 'zod'
import {citizenRpc} from '../../../utils/identity'
import {validate} from '../../../utils/validation'
export default defineEventHandler(async event=>{
 const body=validate(z.object({decision:z.enum(['granted','withdrawn']),confirmed:z.literal(true)}).strict(),await readBody(event))
 return citizenRpc(event,'citizen_consent_decide',{p_purpose_id:String(getRouterParam(event,'purpose')),p_decision:body.decision})
})
