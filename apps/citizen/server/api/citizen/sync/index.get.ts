// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Địa phương nhận và yêu cầu đồng bộ thông tin tự khai đã gửi (api.citizen_sync của lõi).
import {citizenRpc} from '../../../utils/identity'
export default defineEventHandler(event=>citizenRpc(event,'citizen_sync'))
