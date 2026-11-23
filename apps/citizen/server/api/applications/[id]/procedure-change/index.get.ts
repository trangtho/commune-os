// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Phiên bản thủ tục đã thay đổi so với lúc soạn bản nháp (api.citizen_procedure_change của lõi, gọi qua cổng bằng token công dân).
import { citizenRpc } from '../../../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  return citizenRpc(event,'citizen_procedure_change',{p_application_id:String(getRouterParam(event,'id')||'')})
})
