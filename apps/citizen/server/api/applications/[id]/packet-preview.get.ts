// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {getProcedureFormFields} from '../../../../shared/procedure-forms'
import {autofillSuggestions,type CitizenFact,type FactKey} from '../../../../shared/citizen-autofill'
import {recordPersonalDataUse} from '../../../utils/privacy-events'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=String(getRouterParam(event,'id')||'')
 const a=(await client.query('SELECT id,status,procedure_id,form_data,representation_id FROM applications WHERE id=$1',[id])).rows[0]
 if(!a||a.status!=='draft')throw createError({statusCode:404,statusMessage:'Không tìm thấy bản nháp để chuẩn bị hồ sơ'})
 if(a.representation_id)throw createError({statusCode:403,statusMessage:'Không lấy dữ liệu cá nhân của người đại diện để điền hộ hồ sơ'})
 const [profile,self,verified,vault,docs]=await Promise.all([
  client.query('SELECT display_name,phone,address FROM citizens WHERE id=$1',[actor.id]),
  client.query('SELECT birth_date,citizen_identifier FROM citizen_self_facts WHERE citizen_id=$1',[actor.id]),
  client.query('SELECT field_key,field_value,source_issuer,verified_at FROM citizen_verified_facts WHERE citizen_id=$1',[actor.id]),
  client.query(`SELECT d.id,d.title,d.category,v.id AS version_id,v.original_name,v.expires_on
   FROM citizen_vault_documents d JOIN LATERAL(SELECT id,original_name,expires_on FROM citizen_vault_versions WHERE document_id=d.id ORDER BY version_no DESC LIMIT 1)v ON true
   WHERE d.archived_at IS NULL ORDER BY d.created_at DESC LIMIT 40`),
  client.query('SELECT document_code,document_name,is_required FROM procedure_documents WHERE procedure_id=$1 ORDER BY document_code',[a.procedure_id])
 ])
 const raw:Record<FactKey,string>={fullName:profile.rows[0]?.display_name||'',phone:profile.rows[0]?.phone||'',address:profile.rows[0]?.address||'',birthDate:self.rows[0]?.birth_date?.toISOString?.().slice(0,10)||'',citizenIdentifier:self.rows[0]?.citizen_identifier||''}
 const facts:CitizenFact[]=(Object.keys(raw) as FactKey[]).filter(k=>raw[k]).map(key=>({key,value:raw[key],source:'self_declared',sourceLabel:'Công dân tự khai',verifiedAt:null}))
 for(const row of verified.rows){const fact:CitizenFact={key:row.field_key,value:row.field_value,source:'oidc_verified',sourceLabel:'Nguồn đã phê duyệt '+row.source_issuer,verifiedAt:row.verified_at?.toISOString?.()||null};const index=facts.findIndex(f=>f.key===fact.key);if(index>=0)facts[index]=fact;else facts.push(fact)}
 const suggestions=autofillSuggestions(a.procedure_id,facts).filter(s=>!String((a.form_data||{})[s.fieldKey]||'').trim())
 const fields=getProcedureFormFields(a.procedure_id)
 const missingFields=fields.filter(f=>f.required && !String(a.form_data?.[f.key]||'').trim()).map(f=>({key:f.key,label:f.label}))
 const attached=(await client.query('SELECT DISTINCT document_code FROM application_documents WHERE application_id=$1',[id])).rows.map(x=>x.document_code)
 const missingDocuments=docs.rows.filter(d=>d.is_required&&!attached.includes(d.document_code))
 await recordPersonalDataUse(client,actor,{action:'read_autofill',purpose:'Xem trước gợi ý tạo bộ hồ sơ từ dữ liệu cá nhân',resourceKind:'application',resourceReference:id})
 return {applicationId:id,suggestions,missingFields,missingDocuments,vault: vault.rows,
  notice:'Chỉ xem trước, không tự sao chép dữ liệu hay giấy tờ. Chọn trường tự điền và xác nhận chia sẻ từng giấy tờ trong bước kê khai.'}
}))
