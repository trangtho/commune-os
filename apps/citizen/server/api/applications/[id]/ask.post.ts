// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Trợ lý hồ sơ: lõi trả trạng thái, sự kiện của hồ sơ và ghi nhật ký sử dụng dữ liệu (api.citizen_case_facts);
// câu trả lời chỉ dựng từ các dữ kiện đó, không dùng mô hình để phỏng đoán.
import {citizenRpc} from '../../../utils/identity'
import {normalizePhrase,nextCaseActions} from '../../../../shared/citizen-intelligence.mjs'
type Facts={status:string;due_at:string|null;result_note:string|null;procedure_id:string;events:{event_type:string;note:string|null}[]}
export default defineEventHandler(async event=>{
 const id=String(getRouterParam(event,'id')||'')
 const body=await readBody(event)
 const question=typeof body?.question==='string'?body.question.trim():''
 if(question.length<5||question.length>500)throw createError({statusCode:400,statusMessage:'Câu hỏi cần từ 5 đến 500 ký tự'})
 const row=await citizenRpc<Facts>(event,'citizen_case_facts',{p_application_id:id})
 const events=row.events
 const q=normalizePhrase(question)
 let answer='Tôi chỉ trả lời từ trạng thái và sự kiện đã được ghi nhận. Vui lòng kiểm tra chi tiết hồ sơ hoặc liên hệ bộ phận xử lý để làm rõ.'
 let sources=['Trạng thái hồ sơ trong CommuneOS']
 if(/(tien do|buoc nao|trang thai|dang o dau)/.test(q))answer=`Hồ sơ đang ở trạng thái ${row.status}. ${events[0]?.note||'Chưa có ghi chú công đoạn mới.'}`
 else if(/(bo sung|giay to|tai lieu)/.test(q)){
  const supplements=events.filter(e=>/supplement|bo.sung|can bo sung/i.test(e.event_type+' '+e.note))
  answer=supplements.length?`Thông tin bổ sung được ghi nhận: ${supplements[0].note}`:'Chưa thấy yêu cầu bổ sung cụ thể trong các sự kiện mới nhất. Vui lòng xem thông báo chi tiết.'
  sources=['Sự kiện yêu cầu bổ sung của hồ sơ']
 } else if(/(khi nao|bao lau|han|hoan thanh)/.test(q))answer=`Hạn xử lý đang lưu: ${row.due_at?String(row.due_at).slice(0,10):'chưa có'}. Đây không phải cam kết ngày hoàn thành thực tế.`
 else if(/(vi sao|ly do|tai sao)/.test(q))answer=events[0]?.note?`Ghi chú mới nhất từ lịch sử xử lý: ${events[0].note}. Không thể khẳng định nguyên nhân khác khi chưa có thông tin chính thức.`:'Hồ sơ chưa có thông tin giải thích nguyên nhân trong sự kiện được ghi nhận.'
 else if(/(ket qua|nhan ket qua)/.test(q))answer=row.status==='completed'?`Hồ sơ hoàn thành. ${row.result_note||'Bạn có thể xem trang nhận kết quả.'}`:'Hồ sơ chưa ở trạng thái hoàn thành; chưa có căn cứ để nhận kết quả.'
 return {answer,sources,caseId:id,nextActions:nextCaseActions(row.status,id,row.procedure_id),mode:'CASE_FACTS',
  notice:'Không dùng mô hình để phỏng đoán lý do xử lý; không tự thay đổi dữ liệu hồ sơ.'}
})
