// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đề nghị điều chỉnh, xem xét hạn, rút, chuyển cơ quan đã gửi (api.citizen_my_case_requests của lõi, gọi qua cổng bằng token công dân).
import { citizenRpc } from '../../../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  return citizenRpc(event,'citizen_my_case_requests',{p_application_id:String(getRouterParam(event,'id')||'')})
})
