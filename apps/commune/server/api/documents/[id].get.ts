// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>staffTx(event,async(client)=>{
  const id=getRouterParam(event,'id')
  const row=(await client.query(`SELECT d.original_name, d.size_bytes FROM application_documents d WHERE d.id=$1 LIMIT 1`,[id])).rows[0]
  if(!row)throw createError({statusCode:404,statusMessage:'Tệp không tồn tại'})
  // In demo mode, return a placeholder response; real implementation streams file from storage.
  return {id,original_name:row.original_name,size_bytes:row.size_bytes,note:'Tải tệp từ kho lưu trữ mô phỏng'}
}))
