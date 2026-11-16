// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../../../utils/database'
import { validate } from '../../../../utils/validation'
const schema=z.object({kind:z.enum(['deadline_review','amendment','withdrawal','transfer']),
  reason:z.string().trim().min(10).max(2000),destinationTenantId:z.string().uuid().optional()})
export default defineEventHandler(async event=>{
  const body=validate(schema,await readBody(event))
  const id=String(getRouterParam(event,'id')||'')
  const created=await citizenTx(event,async(client,actor)=>{
    const a=(await client.query('SELECT id,procedure_id,status,tenant_id,receiving_tenant_id FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
    if(!a)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
    if(!['submitted','processing','supplement'].includes(a.status))
      throw createError({statusCode:409,statusMessage:'Trạng thái hồ sơ hiện không cho phép gửi đề nghị này'})
    if(body.kind==='transfer'){
      if(!body.destinationTenantId || body.destinationTenantId===(a.receiving_tenant_id||a.tenant_id))
        throw createError({statusCode:422,statusMessage:'Vui lòng chọn cơ quan nhận khác cơ quan hiện tại'})
      const permitted=(await client.query(`SELECT 1 FROM citizen_procedure_receivers
        WHERE procedure_id=$1 AND source_tenant_id=$2 AND receiving_tenant_id=$3 AND enabled
        AND btrim(approval_reference)<>'' AND valid_until>now()`,
        [a.procedure_id,a.receiving_tenant_id||a.tenant_id,body.destinationTenantId])).rowCount
      if(!permitted)throw createError({statusCode:422,statusMessage:'Chưa có tuyến chuyển tiếp được cơ quan phê duyệt'})
      if((await client.query("SELECT 1 FROM citizen_case_transfer_handoffs WHERE application_id=$1 AND status='pending'",[id])).rowCount)
        throw createError({statusCode:409,statusMessage:'Hồ sơ đang chờ một cơ quan khác tiếp nhận, không thể tạo thêm đề nghị chuyển'})
    } else if(body.destinationTenantId)throw createError({statusCode:422,statusMessage:'Không cần thông tin cơ quan nhận'})
    const requests=Number((await client.query(`SELECT count(*)::int AS n FROM citizen_case_requests
      WHERE created_at>now()-interval '24 hours'`)).rows[0].n)
    if(requests>=8)throw createError({statusCode:429,statusMessage:'Bạn đã gửi quá nhiều yêu cầu trong 24 giờ'})
    if((await client.query(`SELECT 1 FROM citizen_case_requests WHERE application_id=$1 AND request_kind=$2 AND status='pending'`,[id,body.kind])).rowCount)
      throw createError({statusCode:409,statusMessage:'Đã có đề nghị cùng loại đang chờ giải quyết'})
    const row=(await client.query(`INSERT INTO citizen_case_requests(application_id,citizen_id,tenant_id,request_kind,reason,proposed_tenant_id)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id,request_kind,status,created_at`,
      [id,actor.id,actor.tenantId,body.kind,body.reason,body.destinationTenantId||null])).rows[0]
    await client.query(`INSERT INTO application_events(application_id,event_type,note,actor_name)
      VALUES($1,'citizen_request', $2,$3)`,[id,'Công dân gửi đề nghị: '+body.kind,actor.name])
    return row
  })
  setResponseStatus(event,201)
  return created
})
