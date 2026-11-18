// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 const localities=(await client.query('SELECT id,name,code FROM tenants WHERE id<>$1 ORDER BY name',[actor.tenantId])).rows
 const requests=(await client.query(`SELECT r.id,r.state,r.provenance,r.created_at,r.reviewed_at,r.review_note,
  t.name AS target_name FROM citizen_sync_requests r JOIN tenants t ON t.id=r.target_tenant_id
  ORDER BY r.created_at DESC LIMIT 40`)).rows
 return {localities,requests,notice:'Yêu cầu trao đổi dữ liệu liên địa phương được kiểm tra thủ công; chưa tự động đồng bộ hồ sơ hay ghi đè dữ liệu đã xác minh.'}
}))
