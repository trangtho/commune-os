// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Hủy lịch tư vấn (api.citizen_consultation_cancel của lõi).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event => {
  const id=getRouterParam(event,'id') || ''
  if(!/^[0-9a-f-]{36}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã lịch hẹn không hợp lệ'})
  return citizenRpc(event,'citizen_consultation_cancel',{p_request_id:id})
})
