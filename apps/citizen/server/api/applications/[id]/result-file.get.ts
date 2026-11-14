// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { requireCompleted, requestResult } from '../../../utils/result-service'
export default defineEventHandler(async event => {
  const id=getRouterParam(event,'id') || ''
  await requireCompleted(event,id)
  const response=await requestResult(id,'/file')
  if(!response)throw createError({statusCode:404,statusMessage:'Chưa có văn bản kết quả'})
  if(!String(response.headers.get('content-type')).toLowerCase().startsWith('application/pdf'))throw createError({statusCode:502,statusMessage:'Dịch vụ trả về định dạng không phải PDF'})
  const buffer=Buffer.from(await response.arrayBuffer())
  if(buffer.length<5||buffer.length>15*1024*1024||buffer.subarray(0,5).toString()!=='%PDF-')throw createError({statusCode:502,statusMessage:'Tệp kết quả không hợp lệ hoặc vượt 15 MB'})
  setResponseHeader(event,'content-type','application/pdf')
  setResponseHeader(event,'content-disposition',`attachment; filename="ket-qua-${id.replace(/[^a-zA-Z0-9-]/g,'')}.pdf"`)
  setResponseHeader(event,'cache-control','private, no-store')
  setResponseHeader(event,'x-content-type-options','nosniff')
  return buffer
})
