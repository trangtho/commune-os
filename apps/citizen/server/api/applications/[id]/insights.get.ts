// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gợi ý bước tiếp, dự báo thời gian, cảnh báo mâu thuẫn: lõi trả dữ kiện và ghi nhật ký sử dụng dữ liệu
// (api.citizen_case_insight_facts); quy tắc diễn giải dùng mã dùng chung.
import {citizenRpc} from '../../../utils/identity'
import {reviewStoredDraft} from '../../../utils/preflight'
import {nextCaseActions,compareObservedFields} from '../../../../shared/citizen-intelligence.mjs'
type Facts={application:{id:string;status:string;procedure_id:string;form_data:Record<string,string>|null;due_at:string|null};
 statistics:{sample_size:number;lower_days:number;upper_days:number;active_count:number}|null;observations:{fields:Record<string,string>;source:string}[]}
export default defineEventHandler(async event=>{
 const id=String(getRouterParam(event,'id')||'')
 const {application:a,statistics,observations}=await citizenRpc<Facts>(event,'citizen_case_insight_facts',{p_application_id:id})
 const count=Number(statistics?.sample_size||0)
 const forecast=count<10?{available:false,sampleSize:count,reason:'Chưa đủ tối thiểu 10 hồ sơ hoàn thành cùng thủ tục, địa phương trong 365 ngày.'}:
  {available:true,sampleSize:count,lowerDays:Number(statistics!.lower_days),upperDays:Number(statistics!.upper_days),activeCount:Number(statistics!.active_count||0),
   basis:'Phân vị 25–75% theo chênh lệch submitted_at/updated_at của hồ sơ đã hoàn thành, có thể lệch thời điểm hoàn tất. Số hồ sơ đang xử lý là bối cảnh, chưa dùng hiệu chỉnh mô hình. KHÔNG thay thế hạn chính thức.',
   deadline:a.due_at}
 const conflicts=compareObservedFields(a.form_data||{},observations)
 const preflight=a.status==='draft'?await reviewStoredDraft(event,id):null
 const warnings=[...(preflight?.blocking||[]).map(x=>x.message),...conflicts.map(x=>x.message)]
 return {caseId:id,status:a.status,nextActions:nextCaseActions(a.status,id,a.procedure_id),forecast,
  risk:{level:warnings.length>=3?'cao':warnings.length?'cần kiểm tra':'chưa phát hiện theo quy tắc',
   warnings,method:'business_rules',notice:'Đây là cảnh báo rà soát, không kết luận hồ sơ hợp lệ hoặc bị từ chối.'},
  conflicts,preflight}
})
