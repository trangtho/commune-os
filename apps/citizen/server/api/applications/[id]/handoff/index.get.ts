// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Các mã chuyển hồ sơ tại quầy gần nhất (api.citizen_case_handoffs của lõi, gọi qua cổng bằng token công dân).
import { citizenRpc } from '../../../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  return citizenRpc(event,'citizen_case_handoffs',{p_application_id:String(getRouterParam(event,'id')||'')})
})
