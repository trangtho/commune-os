// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>{
  try {
    return await staffTx(event,async(client)=>{
      const slug=getRouterParam(event,'slug')
      const p=(await client.query('SELECT id,title,category,summary,icon,sla_days,fee_note,instructions,published FROM procedures WHERE id=$1',[slug])).rows[0]
      if(!p)throw createError({statusCode:404,statusMessage:'Thủ tục không tồn tại'})
      const docs=(await client.query('SELECT document_code,document_name,is_required FROM procedure_documents WHERE procedure_id=$1 ORDER BY document_code',[slug])).rows
      return {...p,documents:docs||[]}
    })
  } catch (e:any) {
    if(e?.statusCode) throw e
    throw createError({statusCode:404,statusMessage:'Thủ tục không tồn tại hoặc không thể kết nối cơ sở dữ liệu'})
  }
})
