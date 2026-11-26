// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đánh giá từng giai đoạn của hồ sơ (api.citizen_stage_reviews của lõi, gọi qua cổng bằng token công dân).
import { citizenRpc } from '../../../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  return citizenRpc(event,'citizen_stage_reviews',{p_application_id:String(getRouterParam(event,'id')||'')})
})
