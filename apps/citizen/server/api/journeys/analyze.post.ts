// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {validate} from '../../utils/validation'
import {publicQuery} from '../../utils/database'
import {readSession} from '../../utils/session'
import {buildLifeJourney} from '../../../shared/life-journey.mjs'
const schema=z.object({situation:z.string().trim().min(5).max(500),representation:z.string().max(60).optional(),locality:z.string().max(60).optional(),channel:z.string().max(60).optional()}).strict()
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','no-store')
 const input=validate(schema,await readBody(event))
 const tenant=readSession(event)?.tenantId||null
 const procedures=await publicQuery<{id:string;title:string;summary:string;category:string;fee_note:string;sla_days:number;documents:{document_code:string;document_name:string;is_required:boolean}[];source_url:string|null;provenance_status:string|null}>(`SELECT p.id,p.title,p.summary,p.category,p.fee_note,p.sla_days,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('document_code',d.document_code,'document_name',d.document_name,'is_required',d.is_required)) FROM procedure_documents d WHERE d.procedure_id=p.id),'[]'::jsonb) AS documents,
  v.source_url,v.provenance_status FROM procedures p LEFT JOIN LATERAL
  (SELECT source_url,provenance_status FROM citizen_procedure_versions WHERE procedure_id=p.id ORDER BY version_no DESC LIMIT 1) v ON true
  WHERE p.published=true AND ($1::uuid IS NULL OR public.procedure_enabled_for($1::uuid,p.id)) ORDER BY p.title LIMIT 300`,[tenant])
 const result=buildLifeJourney(input.situation,procedures,input)
 return {...result,items:result.items.map((item:any)=>{const p=procedures.find(x=>x.id===item.id)
  return {...item,legalSource:p?.source_url||null,provenance:p?.provenance_status||'unverified_demo',legalSourceVerified:false}}),
  // Model-backed classification is not connected; never claim these are verified eligibility decisions.
  disclosure:'Phân tích từ quy tắc và danh mục hệ thống, không thay thế xác nhận của cơ quan có thẩm quyền.'}
})
