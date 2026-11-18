// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {publicQuery} from '../../../utils/database'
export default defineEventHandler(async event=>{
 const id=getRouterParam(event,'id')
 const published=await publicQuery('SELECT 1 FROM procedures WHERE id=$1 AND published',[id])
 if(!published.length)throw createError({statusCode:404,statusMessage:'Không tìm thấy thủ tục được công bố'})
 const items=await publicQuery(`SELECT id,version_no,effective_from,source_url,source_title,source_reference,
  issuing_authority,scope_note,provenance_status,change_sections,change_note,published_at,snapshot
  FROM citizen_procedure_versions WHERE procedure_id=$1 ORDER BY version_no DESC LIMIT 30`,[id])
 setHeader(event,'Cache-Control','no-store')
 return {procedureId:id,current:items[0]||null,versions:items}
})
