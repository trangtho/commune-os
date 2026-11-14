// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { validateProcedureForm, sanitizeProcedureForm } from '../../../shared/procedure-forms'
import { citizenTx } from '../../utils/database'
import { applicationSchema,validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const body=validate(applicationSchema,await readBody(event))
  const id=getRouterParam(event,'id')
  return citizenTx(event,async(client,actor)=>{
    if(body.receivingTenantId && body.receivingTenantId !== actor.tenantId)throw createError({statusCode:422,statusMessage:'Địa phương tiếp nhận không khớp với tài khoản'})
    const row=(await client.query('SELECT id,status,procedure_id FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
    if(!row||row.status!=='draft'||row.procedure_id!==body.procedureId)
      throw createError({statusCode:409,statusMessage:'Không thể sửa hồ sơ đã nộp hoặc khác thủ tục'})
    const issues = validateProcedureForm(body.procedureId, body.formData)
    if (issues.length) throw createError({statusCode: 422, statusMessage: issues[0].message})
    await client.query(`UPDATE applications SET applicant_name=$1,applicant_phone=$2,description=$3,
       form_data=$4::jsonb,updated_at=now() WHERE id=$5`,
       [body.applicantName,body.phone,body.description,JSON.stringify(sanitizeProcedureForm(body.procedureId, body.formData)),id])
    return {id,status:'draft'}
  })
})
