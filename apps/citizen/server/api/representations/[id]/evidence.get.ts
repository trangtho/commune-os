// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tải minh chứng đại diện: lõi kiểm tra quyền và trả khóa tệp (api.citizen_representation_evidence),
// nội dung đọc từ kho đối tượng của lõi.
import { getObject } from '../../../utils/object-store'
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(async event => {
  const id=getRouterParam(event,'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu đại diện'})
  const doc=await citizenRpc<{evidence_key:string;evidence_type:string}>(event,'citizen_representation_evidence',{p_representation_id:id})
  // Never use any filename supplied by the request for disk access.
  if(!/^[0-9a-f-]{36}\.(pdf|png|jpg)$/.test(doc.evidence_key))throw createError({statusCode:404})
  const data=await getObject(doc.evidence_key)
  if(!data)throw createError({statusCode:404,statusMessage:'Không tìm thấy tệp minh chứng'})
  setHeader(event,'Content-Type',doc.evidence_type)
  setHeader(event,'Content-Disposition','attachment; filename="minh-chung.'+doc.evidence_key.split('.').pop()+'"')
  setHeader(event,'Cache-Control','private, no-store')
  setHeader(event,'X-Content-Type-Options','nosniff')
  return data
})
