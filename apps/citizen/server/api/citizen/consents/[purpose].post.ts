// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {citizenTx} from '../../../utils/database'
import {recordPersonalDataUse,activeConsent} from '../../../utils/privacy-events'
import {validate} from '../../../utils/validation'
export default defineEventHandler(async event=>{
 const body=validate(z.object({decision:z.enum(['granted','withdrawn']),confirmed:z.literal(true)}).strict(),await readBody(event))
 return citizenTx(event,async(client,actor)=>{
  const purposeId=String(getRouterParam(event,'purpose'))
  const p=(await client.query(`SELECT * FROM citizen_processing_purposes
 WHERE id=$1 AND published AND legal_basis='consent'`,[purposeId])).rows[0]
  if(!p)throw createError({statusCode:403,statusMessage:'Hoạt động này không cho phép quản lý bằng sự đồng ý'})
  // Serialize decisions for this citizen/purpose to avoid reordered concurrent consent changes.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${actor.id}:${purposeId}`])
  const active=await activeConsent(client,purposeId)
  if(active===(body.decision==='granted'))throw createError({statusCode:409,statusMessage:'Trạng thái quyền chia sẻ đã được cập nhật'})
  await client.query(`INSERT INTO citizen_consent_events(citizen_id,tenant_id,purpose_id,decision,valid_until)
 VALUES($1,$2,$3,$4,CASE WHEN $4='granted' THEN now()+($5::integer*interval '1 day') ELSE NULL END)`,
 [actor.id,actor.tenantId,purposeId,body.decision,p.validity_days])
  await recordPersonalDataUse(client,actor,{action:body.decision==='granted'?'consent_granted':'consent_withdrawn',
    purpose:'Quản lý quyền sử dụng dữ liệu',resourceKind:'consent',resourceReference:purposeId})
  return {ok:true,decision:body.decision,notice:'Rút quyền không thu hồi được các hồ sơ đã nộp hoặc bản sao đã chia sẻ trước đó.'}
 })
})
