// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Thu hồi mã chuyển hồ sơ chưa dùng (api.citizen_case_handoff_revoke của lõi).
import { citizenRpc } from '../../../../utils/identity'
export default defineEventHandler(async event=>{
  const handoffId=getRouterParam(event,'handoffId')||''
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handoffId))throw createError({statusCode:400,statusMessage:'Mã định danh không hợp lệ'})
  return citizenRpc(event,'citizen_case_handoff_revoke',{p_application_id:getRouterParam(event,'id')||'',p_handoff_id:handoffId})
})
