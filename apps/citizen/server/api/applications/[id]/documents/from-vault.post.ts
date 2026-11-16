// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { citizenTx } from '../../../../utils/database'
import { getObject,putObject,deleteObject } from '../../../../utils/object-store'
import { validate } from '../../../../utils/validation'
import { vaultIsUsable,validVaultContent,todayVietnam } from '../../../../../shared/citizen-vault'
const schema=z.object({versionId:z.string().uuid(),documentCode:z.string().min(1).max(100),confirmed:z.literal(true)}).strict()
export default defineEventHandler(async event=>{
 const id=getRouterParam(event,'id')
 const body=validate(schema,await readBody(event))
 // Ownership is checked BEFORE any object read, and again after the copy before attachment.
 const source=await citizenTx(event,async client=>{
  const row=(await client.query(`SELECT v.storage_key,v.original_name,v.mime_type,v.sha256,v.expires_on,d.archived_at
    FROM citizen_vault_versions v JOIN citizen_vault_documents d ON d.id=v.document_id WHERE v.id=$1 FOR SHARE OF v,d`,[body.versionId])).rows[0]
  if(!row)throw createError({statusCode:404,statusMessage:'Không tìm thấy phiên bản giấy tờ thuộc tài khoản'})
  if(!vaultIsUsable(row.archived_at,row.expires_on?.toISOString?.().slice(0,10)??row.expires_on,todayVietnam()))
   throw createError({statusCode:422,statusMessage:'Giấy tờ đã lưu trữ hoặc hết hạn'})
  return row
 })
 const bytes=await getObject(source.storage_key)
 if(!bytes||!validVaultContent(bytes,source.mime_type)||createHash('sha256').update(bytes).digest('hex')!==source.sha256)
  throw createError({statusCode:422,statusMessage:'Tệp nguồn bị thiếu hoặc không bảo đảm tính toàn vẹn'})
 const {key,sha256}=await putObject(bytes,source.mime_type)
 try {
  const result=await citizenTx(event,async(client,actor)=>{
   const app=(await client.query('SELECT id,status,procedure_id FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
   if(!app||!['draft','supplement'].includes(app.status))throw createError({statusCode:403,statusMessage:'Hồ sơ không cho phép bổ sung giấy tờ'})
   const doc=(await client.query(`SELECT v.id,v.expires_on,d.archived_at FROM citizen_vault_versions v
     JOIN citizen_vault_documents d ON d.id=v.document_id WHERE v.id=$1 FOR SHARE OF v,d`,[body.versionId])).rows[0]
   if(!doc||!vaultIsUsable(doc.archived_at,doc.expires_on?.toISOString?.().slice(0,10)??doc.expires_on,todayVietnam()))
    throw createError({statusCode:422,statusMessage:'Giấy tờ nguồn không còn hợp lệ'})
   const allowed=body.documentCode==='other'||(await client.query('SELECT 1 FROM procedure_documents WHERE procedure_id=$1 AND document_code=$2',[app.procedure_id,body.documentCode])).rowCount
   if(!allowed)throw createError({statusCode:422,statusMessage:'Loại giấy tờ không thuộc thủ tục'})
   const total=(await client.query('SELECT count(*)::int AS count FROM application_documents WHERE application_id=$1',[id])).rows[0].count
   if(total>=30)throw createError({statusCode:422,statusMessage:'Hồ sơ chỉ cho phép tối đa 30 tệp'})
   const inserted=(await client.query(`INSERT INTO application_documents(application_id,document_code,original_name,storage_key,mime_type,size_bytes,sha256)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,document_code,original_name,size_bytes,uploaded_at`,[id,body.documentCode,source.original_name,key,source.mime_type,bytes.length,sha256])).rows[0]
   await client.query(`INSERT INTO citizen_vault_shares(citizen_id,tenant_id,version_id,application_id,attachment_id,document_code)
    VALUES($1,$2,$3,$4,$5,$6)`,[actor.id,actor.tenantId,body.versionId,id,inserted.id,body.documentCode])
   return inserted
  })
  setResponseStatus(event,201)
  return result
 }catch(error){await deleteObject(key);throw error}
})
