// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../utils/database'
import {matchSituation} from '../../../../shared/citizen-intelligence.mjs'
export default defineEventHandler(event=>citizenTx(event,async(client,actor)=>{
 setHeader(event,'Cache-Control','private, no-store')
 // No background surveillance of personal facts: ONLY events the citizen voluntarily saved.
 const stored=(await client.query(`SELECT j.id,j.title,j.situation,j.event_code,
 array_remove(array_agg(i.procedure_id),NULL) AS selected_ids
 FROM citizen_life_journeys j LEFT JOIN citizen_life_journey_items i ON i.journey_id=j.id
 WHERE j.status='active' AND j.situation<>'' GROUP BY j.id ORDER BY j.updated_at DESC LIMIT 8`)).rows
 const catalog=(await client.query(`SELECT id,title,summary,category FROM procedures
 WHERE published=true AND public.procedure_enabled_for($1::uuid,id) ORDER BY title LIMIT 300`,[actor.tenantId])).rows
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
}))
