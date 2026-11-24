// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenRpc} from '../../utils/identity'
import {getProcedureFormFields} from '../../../shared/procedure-forms'
import {isInternalEndpoint} from '../../utils/internal-endpoint'
const allowedTypes=['application/pdf','image/png','image/jpeg']
export default defineEventHandler(async event=>{
 const parts=await readMultipartFormData(event)
 const file=parts?.find(x=>x.name==='file'&&x.filename)
 const applicationId=parts?.find(x=>x.name==='applicationId')?.data.toString('utf8')||''
 const confirmed=parts?.find(x=>x.name==='confirmed')?.data.toString('utf8')==='true'
 if(!confirmed)throw createError({statusCode:400,statusMessage:'Cần đồng ý gửi tài liệu đến dịch vụ OCR được cấu hình'})
 if(!file?.data||!allowedTypes.includes(file.type||'')||file.data.length<1||file.data.length>5*1024*1024)
  throw createError({statusCode:415,statusMessage:'Chỉ hỗ trợ ảnh JPG/PNG hoặc PDF không quá 5 MB'})
 const valid=file.type==='application/pdf'?file.data.subarray(0,5).toString()==='%PDF-':file.type==='image/png'?
  file.data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
  file.data[0]===0xff&&file.data[1]===0xd8&&file.data[2]===0xff
 if(!valid)throw createError({statusCode:415,statusMessage:'Nội dung không khớp định dạng tệp'})
 // Chỉ chủ hồ sơ, khi hồ sơ còn chỉnh sửa (lõi kiểm tra quyền qua api.citizen_application_draft).
 const draft=await citizenRpc<{procedure_id:string;status:string}>(event,'citizen_application_draft',{p_application_id:applicationId})
 if(!['draft','supplement'].includes(draft.status))throw createError({statusCode:404,statusMessage:'Chỉ tài khoản chủ hồ sơ được phân tích giấy tờ khi còn chỉnh sửa'})
 const procedureId=String(draft.procedure_id)
 const endpoint=String(process.env.CITIZEN_OCR_ENDPOINT||'')
 const token=String(process.env.CITIZEN_OCR_TOKEN||'')
 let url:URL|null=null
 try{url=new URL(endpoint)}catch{/* OCR not configured */}
 // Giấy tờ là dữ liệu mật: chỉ gửi tới dịch vụ OCR chạy trong mạng nội bộ của đơn vị, không gửi ra Internet.
 if(!url || !isInternalEndpoint(url))
  return {status:'not_configured',fields:[],notice:'Chưa cấu hình dịch vụ OCR chạy trong mạng nội bộ. Hệ thống chỉ kiểm tra chất lượng ảnh tại trình duyệt, không tự nhận dạng chữ.'}
 if(token.length<16)throw createError({statusCode:503,statusMessage:'Dịch vụ OCR thiếu mã xác thực bảo mật'})
 const allowed=new Map(getProcedureFormFields(procedureId).map(f=>[f.key,f.label]))
 // Explicit opt-in: no upload of sensitive documents to third parties without consent.
 const input=new FormData();input.set('file',new Blob([Uint8Array.from(file.data) as unknown as BlobPart],{type:file.type}),file.filename||'document');input.set('requestedFields',JSON.stringify([...allowed.keys()]))
 let response:Response
 try{response=await fetch(url.toString(),{method:'POST',redirect:'error',headers:{authorization:`Bearer ${token}`},
  body:input,signal:AbortSignal.timeout(20000)})}catch{throw createError({statusCode:502,statusMessage:'Không kết nối được dịch vụ OCR'})}
 if(!response.ok)throw createError({statusCode:502,statusMessage:'Dịch vụ OCR không khả dụng hoặc từ chối tài liệu'})
 const text=await response.text()
 if(text.length>100000)throw createError({statusCode:502,statusMessage:'Dữ liệu OCR vượt giới hạn'})
 let parsed:{fields?:Record<string,{value?:unknown;confidence?:unknown}>}
 try{parsed=JSON.parse(text)}catch{throw createError({statusCode:502,statusMessage:'Phản hồi OCR không đúng định dạng JSON'})}
 const fields=Object.entries(parsed.fields||{}).filter(([key])=>allowed.has(key)).slice(0,25).map(([key,item])=>({
  key,label:allowed.get(key),value:typeof item?.value==='string'?item.value.trim().slice(0,200):'',
  confidence:Math.max(0,Math.min(1,Number(item?.confidence)||0))
 })).filter(row=>row.value.length>0)
 setResponseHeader(event,'cache-control','no-store')
 return {status:'suggestions_only',fields,notice:'OCR chỉ cung cấp gợi ý; độ tin cậy thấp phải được kiểm tra thủ công. Không tự ghi hoặc nộp hồ sơ.'}
})
