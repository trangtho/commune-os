// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '../../../../../utils/database'
import { requireStaffBridge } from '../../../../../utils/staff-bridge'
export default defineEventHandler(async event=>{
  const actor=requireStaffBridge(event)
  const handoff=getRouterParam(event,'id')||''
  const doc=getRouterParam(event,'documentId')||''
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(handoff)||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(doc))throw createError({statusCode:400,statusMessage:'Định danh không hợp lệ'})
  const file=(await db().query(`SELECT * FROM citizen_staff_handoff_document($1::uuid,$2::uuid,$3::uuid,$4)`,
    [handoff,doc,actor.tenantId,actor.staffId])).rows[0]
  if(!file)throw createError({statusCode:404,statusMessage:'Không có quyền truy cập tài liệu này'})
  if(!/^[\w-]{36}\.(pdf|png|jpg)$/.test(file.storage_key))throw createError({statusCode:500,statusMessage:'Đường dẫn tệp không hợp lệ'})
  let data:Buffer
  try {data=await readFile(join(String(useRuntimeConfig().storageDir),file.storage_key))}
  catch {throw createError({statusCode:404,statusMessage:'Tài liệu không còn tồn tại'})}
  setResponseHeader(event,'Content-Type',file.mime_type)
  setResponseHeader(event,'Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`)
  setResponseHeader(event,'Cache-Control','no-store')
  setResponseHeader(event,'X-Content-Type-Options','nosniff')
  return data
})
