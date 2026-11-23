// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gửi đề nghị xem xét hạn, điều chỉnh, rút hoặc chuyển cơ quan (api.citizen_case_request_create của lõi).
import { z } from 'zod'
import { citizenRpc } from '../../../../utils/identity'
import { validate } from '../../../../utils/validation'
const schema=z.object({kind:z.enum(['deadline_review','amendment','withdrawal','transfer']),
  reason:z.string().trim().min(10).max(2000),destinationTenantId:z.string().uuid().optional()})
export default defineEventHandler(async event=>{
  const body=validate(schema,await readBody(event))
  const created=await citizenRpc(event,'citizen_case_request_create',{p_application_id:String(getRouterParam(event,'id')||''),
    p_kind:body.kind,p_reason:body.reason,p_destination_tenant_id:body.destinationTenantId??null})
  setResponseStatus(event,201)
  return created
})
