// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {citizenTx} from '../../../../utils/database'
import {recordPersonalDataUse} from '../../../../utils/privacy-events'
import {validate} from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const body=validate(z.object({requestType:z.enum(['access','correct','restrict','erase','retention_review']),
  details:z.string().trim().min(10).max(2000)}).strict(),await readBody(event))
 return citizenTx(event,async(client,actor)=>{
  const row=(await client.query(`INSERT INTO citizen_data_rights_requests(citizen_id,tenant_id,request_type,details)
  VALUES($1,$2,$3,$4) RETURNING id,state,created_at`,[actor.id,actor.tenantId,body.requestType,body.details])).rows[0]
  await recordPersonalDataUse(client,actor,{action:'privacy_request_created',purpose:'Tiếp nhận đề nghị về dữ liệu cá nhân',
    resourceKind:'privacy_request',resourceReference:row.id})
  setResponseStatus(event,201)
  return row
 })
})
