// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type { PoolClient } from 'pg'
import { validateProcedureForm } from '../../shared/procedure-forms'
import { phoneIssue } from '../../shared/identity-validation'
import { permittedReceivingTenant } from './citizen-preferences'
import { requireApprovedRepresentation, requireOwnApplicant } from './representations'
export interface PreflightFinding {code:string; message:string; section:'form'|'document'|'identity'|'routing'; target?:string}
export interface CasePreflight {ready:boolean; blocking:PreflightFinding[]; verify:PreflightFinding[]; checkedAt:string}
export async function reviewStoredDraft(client:PoolClient, actor:{id:string;tenantId:string}, applicationId:string):Promise<CasePreflight>{
 const a=(await client.query('SELECT * FROM applications WHERE id=$1',[applicationId])).rows[0]
 if(!a || a.status!=='draft') throw createError({statusCode:404,statusMessage:'Không tìm thấy bản nháp của bạn'})
 const blocking:PreflightFinding[]=[]
 const add=(section:PreflightFinding['section'],code:string,message:string,target?:string)=>blocking.push({section,code,message,target})
 if(!(await client.query('SELECT 1 FROM procedures WHERE id=$1 AND published',[a.procedure_id])).rowCount)
  add('routing','unpublished','Thủ tục không còn được công bố. Hãy chọn thủ tục khác.')
 for(const issue of validateProcedureForm(a.procedure_id,a.form_data||{}))add('form',issue.key,issue.message,issue.key)
 if(phoneIssue(a.applicant_phone||''))add('form','phone','Số điện thoại liên hệ chưa hợp lệ.','phone')
 if(!(await permittedReceivingTenant(client,{procedureId:a.procedure_id,sourceTenantId:actor.tenantId,receivingTenantId:a.receiving_tenant_id||actor.tenantId})))
  add('routing','receiving_tenant','Địa phương tiếp nhận không còn phù hợp; hãy cập nhật bản nháp.')
 try {
  if(a.representation_id)await requireApprovedRepresentation(client,a.representation_id,a.procedure_id,a.applicant_name)
  else await requireOwnApplicant(client,actor.id,a.applicant_name)
 } catch {add('identity','applicant','Cần xác nhận lại thông tin người nộp hoặc quyền đại diện.','applicantName')}
 const missing=(await client.query(`SELECT d.document_code,d.document_name FROM procedure_documents d
   WHERE d.procedure_id=$1 AND d.is_required AND NOT EXISTS(
    SELECT 1 FROM application_documents f WHERE f.application_id=$2 AND f.document_code=d.document_code)
   ORDER BY d.document_code`,[a.procedure_id,applicationId])).rows
 for(const doc of missing)add('document',doc.document_code,`Thiếu giấy tờ bắt buộc: ${doc.document_name}`,doc.document_code)
 // These are *not* official legal-eligibility decisions; human review remains required.
 const verify:PreflightFinding[]=[
  {section:'document',code:'authenticity',message:'Cần cán bộ kiểm tra tính hợp lệ, tính xác thực của giấy tờ và đối chiếu bản gốc khi quy trình yêu cầu.'},
  {section:'identity',code:'eligibility',message:'Điều kiện pháp lý và thẩm quyền tiếp nhận chỉ được kết luận bởi cơ quan có thẩm quyền.'}
 ]
 return {ready:blocking.length===0,blocking,verify,checkedAt:new Date().toISOString()}
}
