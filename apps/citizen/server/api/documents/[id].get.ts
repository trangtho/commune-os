// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tải giấy tờ: lõi kiểm tra quyền (RLS) và ghi nhật ký sử dụng dữ liệu cá nhân, tệp lấy từ kho đối tượng.
import { getObject } from '../../utils/object-store'
import { citizenRpc } from '../../utils/identity'
import { requireCitizen } from '../../utils/session'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export default defineEventHandler(async(event)=>{
  requireCitizen(event)
  const id=String(getRouterParam(event,'id')||'')
  if(!uuid.test(id))throw createError({statusCode:404,statusMessage:'Không tìm thấy tệp có quyền truy cập'})
  const doc=await citizenRpc<{storage_key:string;original_name:string;mime_type:string}>(event,'citizen_document_file',{p_document_id:id})
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
