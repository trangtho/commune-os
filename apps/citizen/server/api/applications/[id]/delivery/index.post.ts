// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { citizenTx } from '../../../../utils/database'
import { validate } from '../../../../utils/validation'
const schema=z.object({method:z.enum(['online','counter','postal']),deliveryAddress:z.string().trim().max(500).default(''),
 contactPhone:z.string().trim().max(20).default('')})
export default defineEventHandler(async event=>{
 const body=validate(schema,await readBody(event))
 const id=String(getRouterParam(event,'id')||'')
 return citizenTx(event,async(client,actor)=>{
  const a=(await client.query('SELECT procedure_id,tenant_id,receiving_tenant_id,status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
  if(!a)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
  if(['draft','rejected','withdrawn'].includes(a.status))throw createError({statusCode:409,statusMessage:'Hồ sơ chưa đủ điều kiện lựa chọn nhận kết quả'})
  const methodAllowed=(await client.query(`SELECT 1 FROM citizen_result_channels WHERE procedure_id=$1 AND tenant_id=$2
   AND method=$3 AND enabled AND valid_until>now()`,[a.procedure_id,a.receiving_tenant_id||a.tenant_id,body.method])).rowCount
  if(!methodAllowed)throw createError({statusCode:422,statusMessage:'Phương thức nhận kết quả chưa được phê duyệt cho thủ tục này'})
  if(body.method==='postal' && (body.deliveryAddress.length<10 || !/^\+?[0-9\s.-]{9,20}$/.test(body.contactPhone)))
   throw createError({statusCode:422,statusMessage:'Cần địa chỉ giao nhận và số điện thoại hợp lệ'})
  const existing=(await client.query('SELECT status FROM citizen_case_deliveries WHERE application_id=$1 FOR UPDATE',[id])).rows[0]
  if(existing && existing.status!=='selected')throw createError({statusCode:409,statusMessage:'Phương thức nhận kết quả đã được cơ quan xác nhận, không thể tự thay đổi'})
  await client.query(`INSERT INTO citizen_case_deliveries(application_id,citizen_id,tenant_id,method,delivery_address,contact_phone)
   VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(application_id) DO UPDATE SET method=EXCLUDED.method,
   delivery_address=EXCLUDED.delivery_address,contact_phone=EXCLUDED.contact_phone,updated_at=now()`,
   [id,actor.id,actor.tenantId,body.method,body.method==='postal'?body.deliveryAddress:'',body.method==='postal'?body.contactPhone:''])
  await client.query(`INSERT INTO application_events(application_id,event_type,note,actor_name)
   VALUES($1,'delivery_selected',$2,$3)`,[id,'Công dân đăng ký nhận kết quả: '+body.method,actor.name])
  return {ok:true,method:body.method,status:'selected'}
 })
})
