// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {citizenTx} from '../../../utils/database'
import {validate} from '../../../utils/validation'
import {getProcedureFormFields,sanitizeProcedureForm} from '../../../../shared/procedure-forms'
const schema=z.object({formData:z.record(z.string().max(500)),expectedRevision:z.number().int().min(0)}).strict()
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 return citizenTx(event,async(client,actor)=>{
  const id=String(getRouterParam(event,'id')||'')
  const a=(await client.query('SELECT id,procedure_id,status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
  if(!a||a.status!=='draft')throw createError({statusCode:409,statusMessage:'Bản nháp không còn có thể lưu'})
  const fields=getProcedureFormFields(a.procedure_id)
  if(Object.keys(body.formData).length>fields.length || Object.keys(body.formData).some(key=>!fields.some(f=>f.key===key)))
   throw createError({statusCode:422,statusMessage:'Trường kê khai không thuộc biểu mẫu'})
  const old=(await client.query('SELECT revision FROM citizen_draft_cursors WHERE application_id=$1 FOR UPDATE',[id])).rows[0]
  const revision=Number(old?.revision||0)
  if(revision!==body.expectedRevision)throw createError({statusCode:409,statusMessage:'Bản nháp đã được sửa trên thiết bị khác. Hãy tải lại trước khi tiếp tục.'})
  const sanitized=sanitizeProcedureForm(a.procedure_id,body.formData)
  await client.query(`UPDATE applications SET form_data=$1::jsonb,updated_at=now() WHERE id=$2`,[JSON.stringify(sanitized),id])
  const next=revision+1
  await client.query(`INSERT INTO citizen_draft_cursors(application_id,citizen_id,tenant_id,revision)
   VALUES($1,$2,$3,$4) ON CONFLICT(application_id) DO UPDATE SET revision=$4,updated_at=now()`,[id,actor.id,actor.tenantId,next])
  return {applicationId:id,revision:next,savedAt:new Date().toISOString(),notice:'Đã lưu trên máy chủ. Phải rà soát trước khi nộp.'}
 })
})
