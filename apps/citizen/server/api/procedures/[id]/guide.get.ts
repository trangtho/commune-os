// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {publicQuery} from '../../../utils/database'
import {getProcedureFormFields} from '../../../../shared/procedure-forms'
import {guideFormField} from '../../../../shared/citizen-intelligence.mjs'
export default defineEventHandler(async event=>{
 const id=String(getRouterParam(event,'id')||'')
 const found=await publicQuery(`SELECT p.id,p.title,v.source_url,v.provenance_status
 FROM procedures p LEFT JOIN LATERAL (SELECT source_url,provenance_status FROM citizen_procedure_versions
 WHERE procedure_id=p.id ORDER BY version_no DESC LIMIT 1) v ON true
 WHERE p.id=$1 AND p.published`,[id])
 if(!found.length)throw createError({statusCode:404,statusMessage:'Không tìm thấy thủ tục được công bố'})
 return {procedureId:id,fields:getProcedureFormFields(id).map(f=>guideFormField(f,found[0])),
  provenance:found[0].provenance_status,
  notice:'Hướng dẫn thao tác trên biểu mẫu demo. Không tự điền hoặc nộp thay công dân; kiểm tra nguồn pháp lý trước khi sử dụng.'}
})
