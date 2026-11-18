// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {recordPersonalDataUse} from '../../../utils/privacy-events'
import {verifiedProviderPdf,makeToken,hashToken,publicOrigin} from '../../../utils/qr-proof'
export default defineEventHandler(async event=>{
 const id=String(getRouterParam(event,'id')||'')
 const body=await readBody(event)
 if(body?.confirmed!==true)throw createError({statusCode:400,statusMessage:'Bạn phải xác nhận tạo mã kiểm chứng kết quả'})
 const origin=publicOrigin()
 // First check ownership before accessing the external provider.
 await citizenTx(event,async client=>{
  const row=await client.query("SELECT 1 FROM applications WHERE id=$1 AND status='completed'",[id])
  if(!row.rowCount)throw createError({statusCode:404,statusMessage:'Không tìm thấy kết quả đã hoàn thành của bạn'})
 })
 const pdf=await verifiedProviderPdf(id)
 const token=makeToken()
 const result=await citizenTx(event,async(client,actor)=>{
  const row=await client.query("SELECT id FROM applications WHERE id=$1 AND status='completed' FOR UPDATE",[id])
  if(!row.rowCount)throw createError({statusCode:409,statusMessage:'Trạng thái hồ sơ đã thay đổi'})
  await client.query(`UPDATE citizen_result_verifications SET revoked_at=now()
   WHERE application_id=$1 AND revoked_at IS NULL`,[id])
  await recordPersonalDataUse(client,actor,{action:'issue_result_code',purpose:'Cấp mã tra cứu kết quả được phát hành',resourceKind:'application',resourceReference:id})
  return (await client.query(`INSERT INTO citizen_result_verifications
   (citizen_id,tenant_id,application_id,token_hash,document_sha256,result_reference,provider_verification,expires_at)
   VALUES($1,$2,$3,$4,$5,$6,'verified',now()+interval '180 days') RETURNING expires_at`,
   [actor.id,actor.tenantId,id,hashToken(token),pdf.sha256,pdf.reference])).rows[0]
 })
 setResponseHeader(event,'cache-control','no-store')
 return {url:`${origin}/kiem-chung-ket-qua?code=${token}`,qrUrl:`/api/result-verifications/${token}/qr`,expiresAt:result.expires_at,
  notice:'Mã chỉ chứng minh đối chiếu dữ liệu từ dịch vụ cấp kết quả tại thời điểm kiểm tra; không thay chữ ký số chính thức.'}
})
