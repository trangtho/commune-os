// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {getRequestIP} from 'h3'
import {db} from '../../utils/database'
import {tokenOk,hashToken,verifiedProviderPdf} from '../../utils/qr-proof'
const hits=new Map<string,{start:number;count:number}>()
export default defineEventHandler(async event=>{
 setResponseHeader(event,'cache-control','no-store')
 const ip=getRequestIP(event,{xForwardedFor:false})||'unknown'
 const now=Date.now();if(hits.size>4096)for(const [key,value] of hits)if(now-value.start>60_000)hits.delete(key)
 const old=hits.get(ip);const hit=old&&now-old.start<60_000?old:{start:now,count:0};hit.count++;hits.set(ip,hit)
 if(hit.count>25)throw createError({statusCode:429,statusMessage:'Quá nhiều yêu cầu xác minh'})
 const token=String(getRouterParam(event,'token')||'')
 if(!tokenOk(token))throw createError({statusCode:404,statusMessage:'Không có mã kiểm chứng'})
 const res=await db().query('SELECT * FROM citizen_verify_result_public($1)',[hashToken(token)])
 const row=res.rows[0]
 if(!row)return {found:false,status:'not_found',notice:'Không tìm thấy mã tra cứu.'}
 if(!row.active)return {found:true,status:'inactive',issuedAt:row.issued_at,expiresAt:row.expires_at,
  notice:'Mã đã hết hạn, bị thu hồi hoặc hồ sơ không còn ở trạng thái hoàn thành.'}
 try{
  const latest=await verifiedProviderPdf(String(row.application_id))
  const same=latest.sha256===row.document_sha256 && latest.reference===row.reference_code
  return {found:true,status:same?'matched':'changed',reference:same?('••••'+String(row.reference_code||'').slice(-4)):undefined,
   issuedAt:row.issued_at,expiresAt:row.expires_at,
   notice:same?'Tệp PDF hiện tại khớp mã băm tại thời điểm cấp mã. Trạng thái chữ ký do dịch vụ kết quả báo, chưa tự kiểm chứng chứng thư số.':'PDF hoặc mã tham chiếu đã thay đổi; yêu cầu cấp lại hoặc liên hệ cơ quan phát hành.'}
 }catch{
  return {found:true,status:'unavailable',issuedAt:row.issued_at,expiresAt:row.expires_at,
   notice:'Không thể đối chiếu với kho kết quả tại thời điểm này. Không được coi mã là đã xác minh.'}
 }
})
