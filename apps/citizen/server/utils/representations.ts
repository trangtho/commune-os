// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lược đồ đăng ký đại diện nộp thay. Kiểm tra quyền đại diện, người kê khai và nhật ký đại diện nằm ở lõi
// (public.citizen_check_applicant, api.citizen_representation_* trong core/db/init).
import { z } from 'zod'
export const representationSchema = z.object({
  representedName: z.string().trim().min(2).max(120),
  relationship: z.enum(['parent', 'child', 'spouse', 'guardian', 'other']),
  legalBasis: z.enum(['authorization', 'legal_representative']),
  authorizationReference: z.string().trim().max(120).default(''),
  procedureId: z.string().regex(/^[a-z0-9-]{2,80}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})
