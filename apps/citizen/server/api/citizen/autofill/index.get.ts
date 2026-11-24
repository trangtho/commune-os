// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đề xuất tự điền: lõi trả dữ liệu gốc của chính công dân và ghi nhật ký sử dụng (api.citizen_autofill_sources);
// đề xuất theo thủ tục tính ở đây bằng shared/citizen-autofill.ts.
import { citizenRpc } from '../../../utils/identity'
import { autofillSuggestions, type CitizenFact, type FactKey } from '../../../../shared/citizen-autofill'
type Sources={profile:{display_name:string|null;phone:string|null;address:string|null}|null;
 self:{birth_date:string|null;citizen_identifier:string|null}|null;
 verified:{field_key:FactKey;field_value:string;source_issuer:string;verified_at:string}[]}
export default defineEventHandler(async event=>{
 const src=await citizenRpc<Sources>(event,'citizen_autofill_sources')
 const raw:Record<FactKey,string>={fullName:src.profile?.display_name||'',phone:src.profile?.phone||'',address:src.profile?.address||'',
  birthDate:src.self?.birth_date||'',citizenIdentifier:src.self?.citizen_identifier||''}
 const facts:CitizenFact[]=(Object.keys(raw) as FactKey[]).filter(k=>raw[k]).map(key=>({key,value:raw[key],source:'self_declared',sourceLabel:'Hồ sơ công dân tự khai',verifiedAt:null}))
 for(const row of src.verified){
  const index=facts.findIndex(item=>item.key===row.field_key)
  const fact={key:row.field_key,value:row.field_value,source:'oidc_verified' as const,
   sourceLabel:`Nguồn định danh được phê duyệt (${row.source_issuer})`,verifiedAt:new Date(row.verified_at).toISOString()}
  if(index>=0)facts[index]=fact
  else facts.push(fact)
 }
 const procedureId=typeof getQuery(event).procedureId==='string'?String(getQuery(event).procedureId):''
 return {facts, suggestions:procedureId?autofillSuggestions(procedureId,facts):[],self:{birthDate:raw.birthDate,citizenIdentifier:raw.citizenIdentifier}}
})
