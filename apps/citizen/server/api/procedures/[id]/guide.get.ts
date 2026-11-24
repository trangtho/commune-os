// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Hướng dẫn từng trường biểu mẫu; nguồn văn bản từ api.public_procedure_guide_source của lõi.
import {publicRpc} from '../../../utils/identity'
import {getProcedureFormFields} from '../../../../shared/procedure-forms'
import {guideFormField} from '../../../../shared/citizen-intelligence.mjs'
export default defineEventHandler(async event=>{
 const id=String(getRouterParam(event,'id')||'')
 const found=await publicRpc<{id:string;title:string;source_url:string|null;provenance_status:string|null}>('public_procedure_guide_source',{p_procedure_id:id})
 return {procedureId:id,fields:getProcedureFormFields(id).map(f=>guideFormField(f,found)),
  provenance:found.provenance_status,
  notice:'Hướng dẫn thao tác trên biểu mẫu demo. Không tự điền hoặc nộp thay công dân; kiểm tra nguồn pháp lý trước khi sử dụng.'}
})
