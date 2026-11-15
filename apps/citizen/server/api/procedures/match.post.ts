// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod'
import { publicQuery } from '../../utils/database'
import { validate } from '../../utils/validation'
import { matchGuidance, purposes, audiences, situations, localityModes } from '../../../shared/procedure-wizard.mjs'
const answerSchema=z.object({
 purpose:z.enum(['birth','marriage','residence','business','certification','land','unsure']),
 audience:z.enum(['self','child','family','business']),
 locality:z.enum(['residence','temporary','other','unknown']),
 situation:z.enum(['first','update','proof','unsure'])
}).strict()
export default defineEventHandler(async event => {
 setHeader(event,'Cache-Control','no-store')
 const answers=validate(answerSchema,await readBody(event))
 // Only curated database rows can produce a recommendation; never guess legal eligibility.
 const procedures=await publicQuery<{id:string;title:string;summary:string;category:string;published:boolean}>(
  'SELECT id,title,summary,category,published FROM procedures WHERE published=true')
 const rules=await publicQuery<{procedure_id:string;purpose:string;audiences:string[];situations:string[];
  explanation:string;distinction:string;verified_at:string|null;source_reference:string;enabled:boolean}>(
  `SELECT r.procedure_id,r.purpose,r.audiences,r.situations,r.explanation,r.distinction,
    r.verified_at,r.source_reference,r.enabled FROM citizen_procedure_guidance_rules r
    INNER JOIN procedures p ON p.id=r.procedure_id WHERE r.enabled AND p.published`)
 const items=matchGuidance(procedures,rules,answers)
 return {items,localityNotice:answers.locality==='other'
  ? 'Địa phương tiếp nhận khác nơi cư trú chỉ được chọn khi có tuyến tiếp nhận đã được phê duyệt.'
  : 'Địa phương và điều kiện tiếp nhận được kiểm tra riêng khi bắt đầu nộp hồ sơ.',
  advisory:true,answerCount:purposes.length+audiences.length+situations.length+localityModes.length}
})
