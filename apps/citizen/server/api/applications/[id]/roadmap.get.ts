// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lộ trình hồ sơ: lõi trả sự kiện, công đoạn, phiên bản thủ tục, mục bổ sung còn mở (api.citizen_case_roadmap);
// diễn giải trạng thái và gợi ý bước tiếp dùng mã dùng chung.
import {citizenRpc} from '../../../utils/identity'
import {nextCaseActions} from '../../../../shared/citizen-intelligence.mjs'
import {explainCaseStatus} from '../../../../shared/life-journey.mjs'
type Roadmap={application:{id:string;procedure_id:string;status:string;due_at:string|null;updated_at:string};
 needs_version_ack:boolean;unresolved_supplements:number;events:any[];stages:any[]}
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const id=String(getRouterParam(event,'id')||'')
 const r=await citizenRpc<Roadmap>(event,'citizen_case_roadmap',{p_application_id:id})
 const a=r.application
 const explanation=explainCaseStatus(a.status,r.events,r.stages)
 const actions=nextCaseActions(a.status,id,a.procedure_id)
 if(r.needs_version_ack)actions.unshift({title:'Kiểm tra phiên bản thủ tục mới',url:`/nop-ho-so/${encodeURIComponent(a.procedure_id)}?draft=${encodeURIComponent(id)}&step=2`,reason:'Bản nháp chưa xác nhận phiên bản đang áp dụng.'})
 return {applicationId:id,status:a.status,updatedAt:a.updated_at,dueAt:a.due_at,
  explanation,needsVersionAck:r.needs_version_ack,unresolvedSupplements:r.unresolved_supplements||0,
  actions,events:r.events.slice(0,8),stages:r.stages.slice(0,8),
  notice:'Lộ trình dựa trên sự kiện hồ sơ đã lưu, không đoán nguyên nhân hoặc tự thay đổi quyết định cán bộ.'}
})
