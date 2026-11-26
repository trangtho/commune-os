// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Kiểm tra bản nháp trước khi nộp: lõi trả dữ kiện (api.citizen_draft_preflight: thủ tục còn công bố, xã tiếp nhận,
// người kê khai / đại diện, giấy tờ bắt buộc còn thiếu); biểu mẫu và số điện thoại kiểm tra bằng mã dùng chung.
import type { H3Event } from 'h3'
import { validateProcedureForm } from '../../shared/procedure-forms'
import { phoneIssue } from '../../shared/identity-validation'
import { citizenRpc } from './identity'
export interface PreflightFinding {code:string; message:string; section:'form'|'document'|'identity'|'routing'; target?:string}
export interface CasePreflight {ready:boolean; blocking:PreflightFinding[]; verify:PreflightFinding[]; checkedAt:string}
type DraftFacts={procedure_id:string;form_data:Record<string,string>|null;applicant_phone:string|null;published:boolean;
 receiver_ok:boolean;applicant_ok:boolean;missing_documents:{document_code:string;document_name:string}[]}
export async function reviewStoredDraft(event:H3Event, applicationId:string):Promise<CasePreflight>{
 const a=await citizenRpc<DraftFacts>(event,'citizen_draft_preflight',{p_application_id:applicationId})
 const blocking:PreflightFinding[]=[]
 const add=(section:PreflightFinding['section'],code:string,message:string,target?:string)=>blocking.push({section,code,message,target})
 if(!a.published)add('routing','unpublished','Thủ tục không còn được công bố. Hãy chọn thủ tục khác.')
 for(const issue of validateProcedureForm(a.procedure_id,a.form_data||{}))add('form',issue.key,issue.message,issue.key)
 if(phoneIssue(a.applicant_phone||''))add('form','phone','Số điện thoại liên hệ chưa hợp lệ.','phone')
 if(!a.receiver_ok)add('routing','receiving_tenant','Địa phương tiếp nhận không còn phù hợp; hãy cập nhật bản nháp.')
 if(!a.applicant_ok)add('identity','applicant','Cần xác nhận lại thông tin người nộp hoặc quyền đại diện.','applicantName')
 for(const doc of a.missing_documents)add('document',doc.document_code,`Thiếu giấy tờ bắt buộc: ${doc.document_name}`,doc.document_code)
 // These are *not* official legal-eligibility decisions; human review remains required.
 const verify:PreflightFinding[]=[
  {section:'document',code:'authenticity',message:'Cần cán bộ kiểm tra tính hợp lệ, tính xác thực của giấy tờ và đối chiếu bản gốc khi quy trình yêu cầu.'},
  {section:'identity',code:'eligibility',message:'Điều kiện pháp lý và thẩm quyền tiếp nhận chỉ được kết luận bởi cơ quan có thẩm quyền.'}
 ]
 return {ready:blocking.length===0,blocking,verify,checkedAt:new Date().toISOString()}
}
