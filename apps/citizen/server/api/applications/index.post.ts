// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
import { applicationSchema,validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const body=validate(applicationSchema,await readBody(event))
  const valid=(await citizenTx(event,async(client,actor)=>{
    const procedure=(await client.query('SELECT id,sla_days FROM procedures WHERE id=$1 AND published=true',[body.procedureId])).rows[0]
    if(!procedure)throw createError({statusCode:400,statusMessage:'Thủ tục không tồn tại'})
    // Client's form content stays in the draft; final submission requires mandatory documents.
    if(body.procedureId==='khai-sinh' && (!body.formData.childName?.trim()||!body.formData.birthDate?.trim()))
      throw createError({statusCode:400,statusMessage:'Cần điền họ tên và ngày sinh của trẻ'})
    const num=Number((await client.query("SELECT nextval('citizen_case_number') AS number")).rows[0].number)
    const id=`HS-${new Date().getFullYear()}-${String(num).padStart(6,'0')}`
    await client.query(`INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,
      applicant_phone,description,form_data,due_at) VALUES($1,$2,$3,$4,'draft',$5,$6,$7,$8::jsonb,CURRENT_DATE+$9)`,
      [id,actor.id,actor.tenantId,body.procedureId,body.applicantName,body.phone,body.description,JSON.stringify(body.formData),procedure.sla_days])
    return {id,status:'draft'}
  }))
  setResponseStatus(event,201)
  return valid
})
