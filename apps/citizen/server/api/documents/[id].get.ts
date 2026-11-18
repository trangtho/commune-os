// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { getObject } from '../../utils/object-store'
import { citizenTx } from '../../utils/database'
import {recordPersonalDataUse} from '../../utils/privacy-events'
export default defineEventHandler(async(event)=>{
  const id=getRouterParam(event,'id')
  const doc=await citizenTx(event,async(client,actor)=>{
    const row=(await client.query('SELECT storage_key,original_name,mime_type FROM application_documents WHERE id=$1',[id])).rows[0]
    if(!row)throw createError({statusCode:404,statusMessage:'Không tìm thấy tệp có quyền truy cập'})
    await recordPersonalDataUse(client,actor,{action:'download_case_attachment',purpose:'Xem tài liệu hồ sơ',resourceKind:'application_document',resourceReference:String(id)})
    return row
  })
  const buffer=await getObject(doc.storage_key)
  if(!buffer)throw createError({statusCode:404,statusMessage:'Tệp không còn tồn tại'})
  setResponseHeader(event,'content-type',doc.mime_type)
  const inline = getQuery(event).view === '1'
  setResponseHeader(event,'content-disposition',`${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`)
  setResponseHeader(event,'cache-control','private, no-store')
  setResponseHeader(event,'content-security-policy',"sandbox; default-src 'none'")
  setResponseHeader(event,'x-content-type-options','nosniff')
  return buffer
})
