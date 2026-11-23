// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Kiểm tra bản nháp trước khi nộp (dữ kiện từ lõi, xem utils/preflight.ts).
import { reviewStoredDraft } from '../../../utils/preflight'
export default defineEventHandler(event=>reviewStoredDraft(event,String(getRouterParam(event,'id')||'')))
