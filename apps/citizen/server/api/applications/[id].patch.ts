// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
import { applicationSchema,validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const body=validate(applicationSchema,await readBody(event))
  const id=getRouterParam(event,'id')
  return citizenTx(event,async(client)=>{
    const row=(await client.query('SELECT id,status,procedure_id FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
    if(!row||row.status!=='draft'||row.procedure_id!==body.procedureId)
      throw createError({statusCode:409,statusMessage:'Không thể sửa hồ sơ đã nộp hoặc khác thủ tục'})
    if(body.procedureId==='khai-sinh'&&(!body.formData.childName?.trim()||!body.formData.birthDate?.trim()))
      throw createError({statusCode:400,statusMessage:'Thiếu thông tin trẻ đăng ký khai sinh'})
    await client.query(`UPDATE applications SET applicant_name=$1,applicant_phone=$2,description=$3,
       form_data=$4::jsonb,updated_at=now() WHERE id=$5`,
       [body.applicantName,body.phone,body.description,JSON.stringify(body.formData),id])
    return {id,status:'draft'}
  })
})
