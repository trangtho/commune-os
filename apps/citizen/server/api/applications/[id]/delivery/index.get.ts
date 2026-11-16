// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
  setHeader(event,'Cache-Control','private, no-store')
  const id=String(getRouterParam(event,'id')||'')
  const a=(await client.query('SELECT procedure_id,status,tenant_id,receiving_tenant_id FROM applications WHERE id=$1',[id])).rows[0]
  if(!a)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
  const options=(await client.query(`SELECT method,approval_reference,instructions FROM citizen_result_channels
    WHERE procedure_id=$1 AND tenant_id=$2 AND enabled AND valid_until>now() ORDER BY method`,
    [a.procedure_id,a.receiving_tenant_id||a.tenant_id])).rows
  const selection=(await client.query(`SELECT method,delivery_address,contact_phone,status,shipment_reference,staff_note,updated_at
    FROM citizen_case_deliveries WHERE application_id=$1`,[id])).rows[0]||null
  return {options,selection,applicationStatus:a.status,
    notice:options.length?'Chỉ các phương thức được cơ quan công bố còn hiệu lực mới có thể lựa chọn.':
      'Cơ quan chưa công bố phương thức nhận kết quả cho thủ tục và địa phương này; vui lòng liên hệ bộ phận một cửa.'}
}))
