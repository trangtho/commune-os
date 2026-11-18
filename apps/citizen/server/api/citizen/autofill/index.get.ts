// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
import {recordPersonalDataUse} from '../../../utils/privacy-events'
import { autofillSuggestions, type CitizenFact, type FactKey } from '../../../../shared/citizen-autofill'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 const profile=(await client.query('SELECT display_name,phone,address FROM citizens WHERE id=$1',[actor.id])).rows[0]
 const extra=(await client.query('SELECT birth_date,citizen_identifier FROM citizen_self_facts WHERE citizen_id=$1',[actor.id])).rows[0]
 const raw:Record<FactKey,string>={fullName:profile?.display_name||'',phone:profile?.phone||'',address:profile?.address||'',
  birthDate:extra?.birth_date?.toISOString().slice(0,10)||'',citizenIdentifier:extra?.citizen_identifier||''}
 const facts:CitizenFact[]=(Object.keys(raw) as FactKey[]).filter(k=>raw[k]).map(key=>({key,value:raw[key],source:'self_declared',sourceLabel:'Hồ sơ công dân tự khai',verifiedAt:null}))
 const verified=(await client.query('SELECT field_key,field_value,source_issuer,verified_at FROM citizen_verified_facts WHERE citizen_id=$1',[actor.id])).rows
 for(const row of verified){
  const index=facts.findIndex(item=>item.key===row.field_key)
  const fact={key:row.field_key,value:row.field_value,source:'oidc_verified' as const,
   sourceLabel:`Nguồn định danh được phê duyệt (${row.source_issuer})`,verifiedAt:row.verified_at.toISOString()}
  if(index>=0)facts[index]=fact
  else facts.push(fact)
 }
 await recordPersonalDataUse(client,actor,{action:'read_autofill',purpose:'Đề xuất dữ liệu kê khai theo yêu cầu công dân',resourceKind:'autofill'})
 const procedureId=typeof getQuery(event).procedureId==='string'?String(getQuery(event).procedureId):''
 return {facts, suggestions:procedureId?autofillSuggestions(procedureId,facts):[],self:{birthDate:raw.birthDate,citizenIdentifier:raw.citizenIdentifier}}
}))
