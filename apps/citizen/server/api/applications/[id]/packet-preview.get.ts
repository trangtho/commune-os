// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Xem trước bộ hồ sơ: lõi trả dữ liệu của chính công dân, kho giấy tờ, giấy tờ của thủ tục và ghi nhật ký sử dụng
// (api.citizen_packet_sources; từ chối khi bản nháp làm thay người khác). Gợi ý tính bằng mã dùng chung.
import {citizenRpc} from '../../../utils/identity'
import {getProcedureFormFields} from '../../../../shared/procedure-forms'
import {autofillSuggestions,type CitizenFact,type FactKey} from '../../../../shared/citizen-autofill'
type Sources={procedure_id:string;form_data:Record<string,string>|null;
 profile:{display_name:string|null;phone:string|null;address:string|null}|null;self:{birth_date:string|null;citizen_identifier:string|null}|null;
 verified:{field_key:FactKey;field_value:string;source_issuer:string;verified_at:string|null}[];vault:any[];
 documents:{document_code:string;document_name:string;is_required:boolean}[];attached:string[]}
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=String(getRouterParam(event,'id')||'')
 const s=await citizenRpc<Sources>(event,'citizen_packet_sources',{p_application_id:id})
 const form=s.form_data||{}
 const raw:Record<FactKey,string>={fullName:s.profile?.display_name||'',phone:s.profile?.phone||'',address:s.profile?.address||'',birthDate:s.self?.birth_date||'',citizenIdentifier:s.self?.citizen_identifier||''}
 const facts:CitizenFact[]=(Object.keys(raw) as FactKey[]).filter(k=>raw[k]).map(key=>({key,value:raw[key],source:'self_declared',sourceLabel:'Công dân tự khai',verifiedAt:null}))
 for(const row of s.verified){const fact:CitizenFact={key:row.field_key,value:row.field_value,source:'oidc_verified',sourceLabel:'Nguồn đã phê duyệt '+row.source_issuer,verifiedAt:row.verified_at?new Date(row.verified_at).toISOString():null};const index=facts.findIndex(f=>f.key===fact.key);if(index>=0)facts[index]=fact;else facts.push(fact)}
 const suggestions=autofillSuggestions(s.procedure_id,facts).filter(x=>!String(form[x.fieldKey]||'').trim())
 const missingFields=getProcedureFormFields(s.procedure_id).filter(f=>f.required && !String(form[f.key]||'').trim()).map(f=>({key:f.key,label:f.label}))
 const missingDocuments=s.documents.filter(d=>d.is_required&&!s.attached.includes(d.document_code))
 return {applicationId:id,suggestions,missingFields,missingDocuments,vault:s.vault.map(({created_at,...v})=>v),
  notice:'Chỉ xem trước, không tự sao chép dữ liệu hay giấy tờ. Chọn trường tự điền và xác nhận chia sẻ từng giấy tờ trong bước kê khai.'}
})
