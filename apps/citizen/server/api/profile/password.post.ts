// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Mật khẩu công dân nằm ở Keycloak; đổi qua dịch vụ tài khoản của lõi (/accounts/me/password).
import { z } from 'zod'
import { citizenGateway } from '../../utils/identity'
import { requireCitizen } from '../../utils/session'
import { validate } from '../../utils/validation'
const schema = z.object({ oldPassword: z.string().min(1).max(128), newPassword: z.string().min(10).max(128) })
export default defineEventHandler(async (event) => {
  requireCitizen(event)
  const body = validate(schema, await readBody(event))
  try {
    await citizenGateway(event, '/accounts/me/password', {
      method: 'POST', body: { currentPassword: body.oldPassword, newPassword: body.newPassword },
    })
  } catch (error: any) {
    if (error?.statusCode === 401 && !error?.status) throw error
    const status = Number(error?.status) || 502
    throw createError({ statusCode: status >= 500 ? 502 : status, statusMessage: error?.data?.message || 'Chưa đổi được mật khẩu, vui lòng thử lại sau' })
  }
  return { ok: true }
})
