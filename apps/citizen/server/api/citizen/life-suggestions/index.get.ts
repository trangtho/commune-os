// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gợi ý thủ tục theo tình huống công dân đã tự lưu (dữ liệu từ api.citizen_life_suggestion_sources của lõi).
// No background surveillance of personal facts: ONLY events the citizen voluntarily saved.
import {citizenRpc} from '../../../utils/identity'
import {matchSituation} from '../../../../shared/citizen-intelligence.mjs'
type Sources={plans:{id:string;title:string;situation:string;selected_ids:string[]|null}[];catalog:{id:string;title:string;summary:string;category:string}[]}
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const {plans:stored,catalog}=await citizenRpc<Sources>(event,'citizen_life_suggestion_sources')
 const dedup=new Set<string>()
 const items=[]
 for(const plan of stored){
  const chosen=new Set<string>(plan.selected_ids||[])
  for(const p of matchSituation(plan.situation,catalog).items){
   if(chosen.has(p.id)||dedup.has(p.id))continue
   dedup.add(p.id)
   items.push({procedureId:p.id,title:p.title,source:`/thu-tuc/${encodeURIComponent(p.id)}`,
    reason:`Liên quan tới lộ trình “${String(plan.title).slice(0,80)}” mà bạn đã chủ động lưu.`,
    planId:plan.id,method:'rules_from_user_saved_situation'})
  }
 }
 return {items:items.slice(0,10),notice:'Chỉ dựa trên các sự kiện bạn đã tự nhập và lưu. Không tự tạo hồ sơ, không xem xét quyền lợi pháp lý hoặc chuyển dữ liệu cho bên thứ ba.'}
})
