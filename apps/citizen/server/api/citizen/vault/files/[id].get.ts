// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { getObject } from '../../../../utils/object-store'
import { citizenTx } from '../../../../utils/database'
export default defineEventHandler(async event=>{
 const id=getRouterParam(event,'id')
 const doc=await citizenTx(event,async client=>{
  const row=(await client.query(`SELECT v.storage_key,v.original_name,v.mime_type FROM citizen_vault_versions v
   WHERE v.id=$1`,[id])).rows[0]
  if(!row)throw createError({statusCode:404,statusMessage:'Không tìm thấy tệp trong kho của bạn'})
  return row
 })
 const data=await getObject(doc.storage_key)
 if(!data)throw createError({statusCode:404,statusMessage:'Tệp không còn tồn tại trong kho lưu trữ'})
 setResponseHeader(event,'content-type',doc.mime_type)
 setResponseHeader(event,'content-disposition',`${getQuery(event).view==='1'?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`)
 setResponseHeader(event,'cache-control','private, no-store')
 setResponseHeader(event,'content-security-policy',"sandbox; default-src 'none'")
 setResponseHeader(event,'x-content-type-options','nosniff')
 return data
})
