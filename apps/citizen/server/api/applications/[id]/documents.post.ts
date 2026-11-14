// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { citizenTx } from '../../../utils/database'
import { requireCitizen } from '../../../utils/session'
const accepted:Record<string,string>={'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'}
export default defineEventHandler(async(event)=>{
  requireCitizen(event)
  const parts=await readMultipartFormData(event)
  const file=parts?.find(p=>p.name==='file'&&p.filename)
  const code=parts?.find(p=>p.name==='documentCode')?.data.toString('utf8')
  if(!file||!file.data||!code||code.length>100)throw createError({statusCode:400,statusMessage:'Chưa chọn giấy tờ hoặc loại giấy tờ'})
  const suffix=accepted[file.type||'']
  if(!suffix)throw createError({statusCode:415,statusMessage:'Chỉ cho phép PDF, PNG hoặc JPG'})
  if(file.data.length<1||file.data.length>5*1024*1024)throw createError({statusCode:413,statusMessage:'Tệp không được vượt quá 5 MB'})
  const buffer=file.data
  const actual=suffix==='.pdf'?buffer.subarray(0,5).toString()==='%PDF-':suffix==='.png'?buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff
  if(!actual)throw createError({statusCode:415,statusMessage:'Nội dung tệp không khớp định dạng'})
  const storageKey=randomUUID()+suffix
  const folder=String(useRuntimeConfig().storageDir)
  const destination=join(folder,storageKey)
  await mkdir(folder,{recursive:true})
  await writeFile(destination,buffer,{flag:'wx'})
  try {
    return await citizenTx(event,async(client)=>{
      const id=getRouterParam(event,'id')
      const application=(await client.query('SELECT id,procedure_id,status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
      if(!application||!['draft','supplement'].includes(application.status))throw createError({statusCode:403,statusMessage:'Hồ sơ không cho phép tải tài liệu'})
      const allowed=code==='other'||(await client.query('SELECT 1 FROM procedure_documents WHERE procedure_id=$1 AND document_code=$2',[application.procedure_id,code])).rowCount
      if(!allowed)throw createError({statusCode:400,statusMessage:'Loại giấy tờ không hợp lệ'})
      const count=(await client.query('SELECT count(*)::int AS count FROM application_documents WHERE application_id=$1',[id])).rows[0].count
      if(count>=30)throw createError({statusCode:422,statusMessage:'Hồ sơ tối đa 30 tệp; vui lòng liên hệ hỗ trợ nếu cần bổ sung'})
      const originalName=(file.filename||'tai-lieu').replace(/[\\/\r\n\x00-\x1f]/g,'').slice(0,180)
      const result=(await client.query(`INSERT INTO application_documents(application_id,document_code,original_name,storage_key,mime_type,size_bytes)
        VALUES($1,$2,$3,$4,$5,$6) RETURNING id,document_code,original_name,size_bytes,uploaded_at`,
        [id,code,originalName,storageKey,file.type,buffer.length])).rows[0]
      return result
    })
  } catch(error) { await rm(destination,{force:true});throw error }
})
