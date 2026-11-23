// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lãnh đạo giao việc cho cán bộ (có thể gắn với một hồ sơ của dân và hạn hoàn thành).
import { z } from 'zod'
import { coreRpc } from '../../utils/core-api'

const schema = z.object({
  assigneeId: z.string().min(1).max(64), assigneeName: z.string().trim().min(1).max(120),
  title: z.string().trim().min(3, 'Tên việc ít nhất 3 ký tự').max(160),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(),
  dossierId: z.string().trim().max(40).optional(),
})

export default defineEventHandler(async (event) => {
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ' })
  const b = parsed.data
  return coreRpc(event, 'create_staff_task', {
    assignee_id: b.assigneeId, assignee_name: b.assigneeName, title: b.title,
    description: b.description || null, due_date: b.dueDate || null, dossier_id: b.dossierId || null,
  })
})
