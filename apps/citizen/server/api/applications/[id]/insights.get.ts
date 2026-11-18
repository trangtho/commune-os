// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {reviewStoredDraft} from '../../../utils/preflight'
import {nextCaseActions,compareObservedFields} from '../../../../shared/citizen-intelligence.mjs'
import {recordPersonalDataUse} from '../../../utils/privacy-events'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 const id=String(getRouterParam(event,'id')||'')
 const a=(await client.query('SELECT * FROM applications WHERE id=$1',[id])).rows[0]
 if(!a)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ của bạn'})
 const statistics=(await client.query('SELECT * FROM citizen_forecast_days($1,$2)',[a.procedure_id,actor.tenantId])).rows[0]
 const count=Number(statistics?.sample_size||0)
 const forecast=count<10?{available:false,sampleSize:count,reason:'Chưa đủ tối thiểu 10 hồ sơ hoàn thành cùng thủ tục, địa phương trong 365 ngày.'}:
  {available:true,sampleSize:count,lowerDays:Number(statistics.lower_days),upperDays:Number(statistics.upper_days),activeCount:Number(statistics.active_count||0),
   basis:'Phân vị 25–75% theo chênh lệch submitted_at/updated_at của hồ sơ đã hoàn thành, có thể lệch thời điểm hoàn tất. Số hồ sơ đang xử lý là bối cảnh, chưa dùng hiệu chỉnh mô hình. KHÔNG thay thế hạn chính thức.',
   deadline:a.due_at}
 const docs=(await client.query(`SELECT o.fields,d.original_name AS source
 FROM citizen_document_observations o JOIN application_documents d ON d.id=o.document_id
 WHERE o.application_id=$1 ORDER BY o.confirmed_at DESC LIMIT 30`,[id])).rows
 const conflicts=compareObservedFields(a.form_data||{},docs)
 const preflight=a.status==='draft'?await reviewStoredDraft(client,actor,id):null
 const warnings=[...(preflight?.blocking||[]).map(x=>x.message),...conflicts.map(x=>x.message)]
 await recordPersonalDataUse(client,actor,{action:'view_case',purpose:'Gợi ý bước tiếp theo và cảnh báo hồ sơ',resourceKind:'application',resourceReference:id})
 return {caseId:id,status:a.status,nextActions:nextCaseActions(a.status,id,a.procedure_id),forecast,
  risk:{level:warnings.length>=3?'cao':warnings.length?'cần kiểm tra':'chưa phát hiện theo quy tắc',
   warnings,method:'business_rules',notice:'Đây là cảnh báo rà soát, không kết luận hồ sơ hợp lệ hoặc bị từ chối.'},
  conflicts,preflight}
}))
