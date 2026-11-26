// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Phân tích tình huống thành lộ trình: danh mục từ lõi (api.public_journey_catalog; công dân chỉ thấy thủ tục xã
// mình mở), quy tắc ở shared/life-journey.mjs.
import {z} from 'zod'
import {validate} from '../../utils/validation'
import {catalogRpc} from '../../utils/identity'
import {buildLifeJourney} from '../../../shared/life-journey.mjs'
const schema=z.object({situation:z.string().trim().min(5).max(500),representation:z.string().max(60).optional(),locality:z.string().max(60).optional(),channel:z.string().max(60).optional()}).strict()
type Row={id:string;title:string;summary:string;category:string;fee_note:string;sla_days:number;documents:{document_code:string;document_name:string;is_required:boolean}[];source_url:string|null;provenance_status:string|null}
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','no-store')
 const input=validate(schema,await readBody(event))
 const procedures=await catalogRpc<Row[]>(event,'public_journey_catalog')
 const result=buildLifeJourney(input.situation,procedures,input)
 return {...result,items:result.items.map((item:any)=>{const p=procedures.find(x=>x.id===item.id)
  return {...item,legalSource:p?.source_url||null,provenance:p?.provenance_status||'unverified_demo',legalSourceVerified:false}}),
  // Model-backed classification is not connected; never claim these are verified eligibility decisions.
  disclosure:'Phân tích từ quy tắc và danh mục hệ thống, không thay thế xác nhận của cơ quan có thẩm quyền.'}
})
