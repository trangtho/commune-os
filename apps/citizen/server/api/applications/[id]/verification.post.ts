// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Cấp mã kiểm chứng kết quả: lõi kiểm tra hồ sơ đã hoàn thành (api.citizen_result_check) trước khi hỏi dịch vụ cấp
// kết quả, rồi ghi mã (chỉ lưu mã băm), thu hồi mã cũ, ghi nhật ký trong một giao dịch (api.citizen_result_verification_issue).
import {citizenRpc} from '../../../utils/identity'
import {verifiedProviderPdf,makeToken,hashToken,publicOrigin} from '../../../utils/qr-proof'
export default defineEventHandler(async event=>{
 const id=String(getRouterParam(event,'id')||'')
 const body=await readBody(event)
 if(body?.confirmed!==true)throw createError({statusCode:400,statusMessage:'Bạn phải xác nhận tạo mã kiểm chứng kết quả'})
 const origin=publicOrigin()
 // First check ownership before accessing the external provider.
 await citizenRpc(event,'citizen_result_check',{p_application_id:id})
 const pdf=await verifiedProviderPdf(id)
 const token=makeToken()
 const result=await citizenRpc<{expires_at:string}>(event,'citizen_result_verification_issue',{p_application_id:id,
  p_token_hash:hashToken(token),p_document_sha256:pdf.sha256,p_reference:pdf.reference})
 setResponseHeader(event,'cache-control','no-store')
 return {url:`${origin}/kiem-chung-ket-qua?code=${token}`,qrUrl:`/api/result-verifications/${token}/qr`,expiresAt:result.expires_at,
  notice:'Mã chỉ chứng minh đối chiếu dữ liệu từ dịch vụ cấp kết quả tại thời điểm kiểm tra; không thay chữ ký số chính thức.'}
})
