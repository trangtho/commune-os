// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Danh sách địa phương và xã nào đang mở thủ tục (api.public_localities của lõi); công dân thấy thêm xã nhận
// được hồ sơ từ xã mình theo tuyến tiếp nhận được phê duyệt (api.citizen_receivers).
import { citizenRpc, publicRpc } from '../../utils/identity'
import { readSession } from '../../utils/session'
export default defineEventHandler(async event => {
  const actor = readSession(event)
  const raw = typeof getQuery(event).procedureId === 'string' ? String(getQuery(event).procedureId).slice(0, 80) : ''
  const procedureId = /^[a-z0-9-]{2,80}$/.test(raw) ? raw : ''
  const rows = await publicRpc<{ id:string;code:string;name:string;procedure_open:boolean|null }[]>('public_localities', { p_procedure_id: procedureId })
  if (!actor) return rows.map(({procedure_open, ...row}) => ({ ...row, canReceive: false, isAccountLocality: false }))
  const permitted = procedureId && actor.authMethod === 'keycloak' ? await citizenRpc<string[]>(event, 'citizen_receivers', { p_procedure_id: procedureId }) : []
  const allowed = new Set([actor.tenantId, ...permitted])
  // Xã tiếp nhận còn phải đang mở thủ tục này (quản trị bật/tắt ở bảng quản trị lõi).
  return rows.map(({procedure_open, ...row}) => ({
    ...row,
    canReceive: allowed.has(row.id) && procedure_open !== false,
    procedureOpen: procedure_open !== false,
    isAccountLocality: row.id === actor.tenantId,
  }))
})
