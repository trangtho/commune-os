// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Cán bộ gửi yêu cầu cho lãnh đạo: sửa hồ sơ, bỏ giấy tờ, hoặc yêu cầu khác.
// (Thêm giấy tờ đi qua /api/me/documents vì có tệp; trình duyệt hồ sơ dân đi qua /api/applications/:id/approval.)
import { z } from 'zod'
import { coreRpc } from '../../utils/core-api'

const text = (max: number) => z.string().trim().max(max)
const schema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('profile_update'),
    changes: z.object({
      full_name: text(120).optional(), gender: z.enum(['', 'nam', 'nu', 'khac']).optional(),
      birth_date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(),
      position: text(120).optional(), department: text(120).optional(), duties: text(500).optional(),
      education: text(200).optional(), phone: text(20).optional(), work_email: text(120).optional(),
      address: text(300).optional(),
    }),
    note: text(1000).optional(),
  }),
  z.object({ kind: z.literal('document_remove'), documentId: z.string().uuid(), note: text(1000).optional() }),
  z.object({ kind: z.literal('other'), note: text(1000).min(5, 'Nội dung yêu cầu ít nhất 5 ký tự') }),
])

export default defineEventHandler(async (event) => {
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' })
  const b = parsed.data
  if (b.kind === 'profile_update') return coreRpc(event, 'request_profile_update', { changes: b.changes, note: b.note || null })
  if (b.kind === 'document_remove') return coreRpc(event, 'request_document_remove', { document_id: b.documentId, note: b.note || null })
  return coreRpc(event, 'request_other', { note: b.note })
})
