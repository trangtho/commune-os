// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../../utils/database'
import { dbIssue } from '../../utils/db-diagnostics'
export default defineEventHandler(async(event)=>{
  const id=getRouterParam(event,'id')
  try {
    const procedure=(await publicQuery('SELECT * FROM procedures WHERE id=$1 AND published=true',[id]))[0]
    if(!procedure)throw createError({statusCode:404,statusMessage:'Không tìm thấy thủ tục'})
    const documents=await publicQuery('SELECT document_code,document_name,is_required FROM procedure_documents WHERE procedure_id=$1 ORDER BY document_code',[id])
    return {...procedure,documents}
  } catch (error) {
    if ((error as {statusCode?:number})?.statusCode===404) throw error
    const issue=dbIssue(error)
    console.error('[procedure-detail] Database query failed, reason:',issue.code)
    throw createError({ statusCode:503, statusMessage:issue.message, data:{errorCode:issue.code} })
  }
})
