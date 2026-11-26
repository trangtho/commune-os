// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Trả lời một mục bổ sung (api.citizen_supplement_answer của lõi).
import { z } from 'zod'
import { validate } from '../../../../utils/validation'
import { citizenRpc } from '../../../../utils/identity'
const schema=z.object({response:z.string().trim().min(2).max(1000).nullable().optional(),documentId:z.string().uuid().nullable().optional()})
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 const itemId=validate(z.string().uuid(),getRouterParam(event,'itemId'))
 return citizenRpc(event,'citizen_supplement_answer',{p_application_id:String(getRouterParam(event,'id')||''),p_item_id:itemId,
  p_response:body.response||null,p_document_id:body.documentId||null})
})
