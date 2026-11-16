// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../../../utils/database'
import { expirySchema } from '../../../../utils/vault'
import { validate } from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const id=getRouterParam(event,'id')
 const body=validate(z.object({expiresOn:expirySchema}).strict(),await readBody(event))
 return citizenTx(event,async client=>{
  const row=(await client.query(`UPDATE citizen_vault_versions v SET expires_on=$2 WHERE v.id=$1
    AND EXISTS(SELECT 1 FROM citizen_vault_documents d WHERE d.id=v.document_id AND d.archived_at IS NULL)
    RETURNING id,expires_on`,[id,body.expiresOn])).rows[0]
  if(!row)throw createError({statusCode:404,statusMessage:'Không tìm thấy phiên bản có quyền cập nhật'})
  return row
 })
})
