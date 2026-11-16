// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../../utils/database'
import { getPreferences } from '../../../../utils/citizen-preferences'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=String(getRouterParam(event,'id')||'')
 const a=(await client.query(`SELECT a.procedure_id,a.tenant_id,a.receiving_tenant_id,a.status,
  t.name AS receiving_name FROM applications a JOIN tenants t ON t.id=COALESCE(a.receiving_tenant_id,a.tenant_id)
  WHERE a.id=$1`,[id])).rows[0]
 if(!a)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
 const currentTenantId=a.receiving_tenant_id||a.tenant_id
 const candidates=(await client.query(`SELECT cr.receiving_tenant_id AS tenant_id,t.name AS tenant_name,
   cr.approval_reference,cr.valid_until FROM citizen_procedure_receivers cr JOIN tenants t ON t.id=cr.receiving_tenant_id
   WHERE cr.procedure_id=$1 AND cr.source_tenant_id=$2 AND cr.enabled
   AND cr.valid_until>now() AND btrim(cr.approval_reference)<>'' ORDER BY t.name`,
   [a.procedure_id,currentTenantId])).rows
 const prefs=await getPreferences(client,actor.id)
 const suggestedId=prefs.residence_tenant_id||prefs.temporary_tenant_id||null
 const transfers=(await client.query(`SELECT h.id,h.source_tenant_id,h.destination_tenant_id,
   t.name AS destination_name,h.status,h.created_at,h.decided_at,h.decision_note
   FROM citizen_case_transfer_handoffs h JOIN tenants t ON t.id=h.destination_tenant_id
   WHERE h.application_id=$1 ORDER BY h.created_at DESC LIMIT 30`,[id])).rows
 return {currentTenantId,currentTenantName:a.receiving_name,candidates,transfers,applicationStatus:a.status,
  suggestedTenantId:candidates.some(c=>c.tenant_id===suggestedId)?suggestedId:null,
  verifiedLocality:Boolean(prefs.locality_source==='oidc_verified'&&prefs.locality_verified_at),
  notice:'Gợi ý dựa trên tuyến được công bố và địa phương khai báo. Cơ quan có thẩm quyền phải xem xét và xác nhận chuyển giao; thông tin cư trú tự khai không thay thế xác minh pháp lý.'}
}))
