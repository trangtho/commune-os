// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { putObject,deleteObject } from '../../../utils/object-store'
import { citizenTx } from '../../../utils/database'
import { requireCitizen } from '../../../utils/session'
import { documentSchema,expirySchema,uploadPart,partText } from '../../../utils/vault'
import { validate } from '../../../utils/validation'
const versionSchema=z.object({documentId:z.string().uuid().optional(),expiresOn:expirySchema.optional()})
export default defineEventHandler(async event=>{
 requireCitizen(event)
 const parts=await readMultipartFormData(event)
 if(!parts)throw createError({statusCode:400,statusMessage:'Thiếu dữ liệu tải lên'})
 const file=uploadPart(parts)
 const options=validate(versionSchema,{documentId:partText(parts,'documentId')||undefined,expiresOn:partText(parts,'expiresOn')||null})
 const meta=options.documentId?null:validate(documentSchema,{title:partText(parts,'title'),category:partText(parts,'category')})
 const {key,sha256}=await putObject(file.bytes,file.mime)
 try{
  const result=await citizenTx(event,async(client,actor)=>{
   let documentId=options.documentId
   if(documentId){
    const doc=(await client.query('SELECT id,archived_at FROM citizen_vault_documents WHERE id=$1 FOR UPDATE',[documentId])).rows[0]
    if(!doc || doc.archived_at)throw createError({statusCode:404,statusMessage:'Giấy tờ đã lưu trữ hoặc không tồn tại'})
   }else{
    const count=(await client.query('SELECT count(*)::int AS total FROM citizen_vault_documents')).rows[0].total
    if(count>=100)throw createError({statusCode:422,statusMessage:'Kho tối đa 100 nhóm giấy tờ'})
    documentId=(await client.query(`INSERT INTO citizen_vault_documents(citizen_id,tenant_id,title,category)
      VALUES($1,$2,$3,$4) RETURNING id`,[actor.id,actor.tenantId,meta!.title,meta!.category])).rows[0].id
   }
   const last=(await client.query('SELECT COALESCE(max(version_no),0)::int AS last FROM citizen_vault_versions WHERE document_id=$1',[documentId])).rows[0].last
   if(last>=100)throw createError({statusCode:422,statusMessage:'Giấy tờ tối đa 100 phiên bản'})
   const row=(await client.query(`INSERT INTO citizen_vault_versions(document_id,version_no,original_name,storage_key,mime_type,size_bytes,sha256,expires_on)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,version_no`,[documentId,last+1,file.name,key,file.mime,file.bytes.length,sha256,options.expiresOn])).rows[0]
   await client.query('UPDATE citizen_vault_documents SET updated_at=now() WHERE id=$1',[documentId])
   return {documentId,...row}
  })
  setResponseStatus(event,201)
  return result
 }catch(error){await deleteObject(key);throw error}
})
