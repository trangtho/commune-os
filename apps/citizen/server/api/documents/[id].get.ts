// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { citizenTx } from '../../utils/database'
export default defineEventHandler(async(event)=>{
  const id=getRouterParam(event,'id')
  const doc=await citizenTx(event,async(client)=>{
    const row=(await client.query('SELECT storage_key,original_name,mime_type FROM application_documents WHERE id=$1',[id])).rows[0]
    if(!row)throw createError({statusCode:404,statusMessage:'Không tìm thấy tệp có quyền truy cập'})
    return row
  })
  const base=String(useRuntimeConfig().storageDir)
  if(!/^[\w-]{36}\.(pdf|png|jpg)$/.test(doc.storage_key))throw createError({statusCode:500,statusMessage:'Tệp lưu trữ không hợp lệ'})
  let buffer:Buffer
  try {buffer=await readFile(join(base,doc.storage_key))}catch{throw createError({statusCode:404,statusMessage:'Tệp không còn tồn tại'})}
  setResponseHeader(event,'content-type',doc.mime_type)
  const inline = getQuery(event).view === '1'
  setResponseHeader(event,'content-disposition',`${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`)
  setResponseHeader(event,'cache-control','private, no-store')
  setResponseHeader(event,'content-security-policy',"sandbox; default-src 'none'")
  setResponseHeader(event,'x-content-type-options','nosniff')
  return buffer
})
