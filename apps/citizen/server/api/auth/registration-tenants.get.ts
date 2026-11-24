// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Các xã đang hoạt động để người dân chọn xã cư trú khi đăng ký (API công khai của lõi).
import { publicRpc } from '../../utils/identity'
export default defineEventHandler(() => publicRpc<{ code: string; name: string }[]>('public_registration_tenants'))
