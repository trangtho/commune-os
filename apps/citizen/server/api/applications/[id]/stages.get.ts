// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Công đoạn xử lý do cán bộ cập nhật (api.citizen_case_stages của lõi, gọi qua cổng bằng token công dân).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  return citizenRpc(event,'citizen_case_stages',{p_application_id:String(getRouterParam(event,'id')||'')})
})
