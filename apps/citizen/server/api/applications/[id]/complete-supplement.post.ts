// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Gửi bổ sung hồ sơ: lõi kiểm tra từng yêu cầu bổ sung đã được đáp ứng rồi chuyển hồ sơ về xử lý (api.citizen_complete_supplement của lõi, gọi qua cổng bằng token công dân).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  return citizenRpc(event,'citizen_complete_supplement',{p_application_id:String(getRouterParam(event,'id')||'')})
})
