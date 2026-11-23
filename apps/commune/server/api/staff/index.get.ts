// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Danh sách cán bộ của xã (chỉ lãnh đạo xem được), từ dịch vụ tài khoản của lõi.
import { coreAccounts } from '../../utils/core-accounts'

export default defineEventHandler((event) => coreAccounts(event, '/staff'))
