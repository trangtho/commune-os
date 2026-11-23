// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Thu hồi quyền đại diện của chính mình (api.citizen_representation_revoke của lõi).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event => {
  const id = getRouterParam(event,'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw createError({statusCode:400,statusMessage:'Mã quyền đại diện không hợp lệ'})
  return citizenRpc(event,'citizen_representation_revoke',{p_representation_id:id})
})
