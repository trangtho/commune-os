// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Các mục bổ sung của lần yêu cầu gần nhất (api.citizen_supplement_items của lõi, gọi qua cổng bằng token công dân).
import { citizenRpc } from '../../../../utils/identity'
export default defineEventHandler(event=>{
  setHeader(event,'Cache-Control','private, no-store')
  return citizenRpc(event,'citizen_supplement_items',{p_application_id:String(getRouterParam(event,'id')||'')})
})
