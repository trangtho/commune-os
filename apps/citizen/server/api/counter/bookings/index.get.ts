// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lượt đã đặt tại bộ phận một cửa (api.citizen_counter_bookings của lõi).
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event=>citizenRpc(event,'citizen_counter_bookings'))
