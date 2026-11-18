// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../../utils/database'
import { documentSchema } from '../../../utils/vault'
import { validate } from '../../../utils/validation'
const patchSchema=documentSchema.partial().extend({archived:z.boolean().optional()}).strict().refine(v=>Object.keys(v).length>0)
export default defineEventHandler(async event=>{
 const id=getRouterParam(event,'id');const body=validate(patchSchema,await readBody(event))
 return citizenTx(event,async client=>{
  const row=(await client.query(`UPDATE citizen_vault_documents SET title=COALESCE($2,title),category=COALESCE($3,category),
   archived_at=CASE WHEN $4::boolean IS NULL THEN archived_at WHEN $4 THEN now() ELSE NULL END,updated_at=now()
   WHERE id=$1 RETURNING id,title,category,archived_at`,[id,body.title??null,body.category??null,body.archived??null])).rows[0]
  if(!row)throw createError({statusCode:404,statusMessage:'Không tìm thấy giấy tờ có quyền sửa'})
  return row
 })
})
