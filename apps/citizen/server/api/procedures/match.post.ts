// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gợi ý thủ tục theo câu trả lời: chỉ từ quy tắc đã biên soạn (api.public_guidance_rules của lõi).
import { z } from 'zod'
import { publicRpc } from '../../utils/identity'
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
 const {procedures,rules}=await publicRpc<{procedures:any[];rules:any[]}>('public_guidance_rules')
 const items=matchGuidance(procedures,rules,answers)
 return {items,localityNotice:answers.locality==='other'
  ? 'Địa phương tiếp nhận khác nơi cư trú chỉ được chọn khi có tuyến tiếp nhận đã được phê duyệt.'
  : 'Địa phương và điều kiện tiếp nhận được kiểm tra riêng khi bắt đầu nộp hồ sơ.',
  advisory:true,answerCount:purposes.length+audiences.length+situations.length+localityModes.length}
})
