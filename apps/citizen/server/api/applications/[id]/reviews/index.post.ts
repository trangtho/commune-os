// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đánh giá một giai đoạn hồ sơ đã trải qua (api.citizen_stage_review_create của lõi, điều kiện như stageEligible).
import { z } from 'zod'
import { citizenRpc } from '../../../../utils/identity'
import { validate } from '../../../../utils/validation'
const schema=z.object({stage:z.enum(['guidance','reception','supplement','result']),rating:z.number().int().min(1).max(5),comment:z.string().trim().max(1000).default('')})
export default defineEventHandler(async event=>{
  const body=validate(schema,await readBody(event))
  const row=await citizenRpc(event,'citizen_stage_review_create',{p_application_id:getRouterParam(event,'id')||'',
    p_stage:body.stage,p_rating:body.rating,p_comment:body.comment})
  setResponseStatus(event,201)
  return row
})
