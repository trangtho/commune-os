// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Sửa tên, loại hoặc lưu trữ giấy tờ trong kho (api.citizen_vault_update của lõi).
import { z } from 'zod'
import { citizenRpc } from '../../../utils/identity'
import { documentSchema } from '../../../utils/vault'
import { validate } from '../../../utils/validation'
const patchSchema=documentSchema.partial().extend({archived:z.boolean().optional()}).strict().refine(v=>Object.keys(v).length>0)
export default defineEventHandler(async event=>{
 const id=validate(z.string().uuid(),getRouterParam(event,'id'))
 const body=validate(patchSchema,await readBody(event))
 return citizenRpc(event,'citizen_vault_update',{p_document_id:id,p_title:body.title??null,p_category:body.category??null,p_archived:body.archived??null})
})
