// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(async event => {
  const id=getRouterParam(event,'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu đại diện'})
  const doc=await citizenTx(event,async client => (await client.query('SELECT evidence_key,evidence_type FROM citizen_representations WHERE id=$1',[id])).rows[0])
  if(!doc?.evidence_key||!doc.evidence_type)throw createError({statusCode:404,statusMessage:'Chưa có minh chứng hoặc không có quyền xem'})
  // Never use any filename supplied by the request for disk access.
  if(!/^[0-9a-f-]{36}\.(pdf|png|jpg)$/.test(doc.evidence_key))throw createError({statusCode:404})
  const data=await readFile(join(String(useRuntimeConfig().storageDir),doc.evidence_key)).catch(() => {throw createError({statusCode:404,statusMessage:'Không tìm thấy tệp minh chứng'})})
  setHeader(event,'Content-Type',doc.evidence_type)
  setHeader(event,'Content-Disposition','attachment; filename="minh-chung."'+doc.evidence_key.split('.').pop()+'"')
  setHeader(event,'Cache-Control','private, no-store')
  setHeader(event,'X-Content-Type-Options','nosniff')
  return data
})
