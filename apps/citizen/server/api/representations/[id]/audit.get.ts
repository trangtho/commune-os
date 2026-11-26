// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Nhật ký sử dụng một quyền đại diện (api.citizen_representation_audit của lõi).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event => {
  const id=getRouterParam(event,'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw createError({statusCode:404,statusMessage:'Không tìm thấy yêu cầu đại diện'})
  return citizenRpc(event,'citizen_representation_audit',{p_representation_id:id})
})
