// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Kho giấy tờ của công dân: gọi lõi (api.citizen_vault) qua cổng APISIX, RLS theo công dân.
import { citizenRpc } from '../../../utils/identity'
export default defineEventHandler(event=>citizenRpc(event,'citizen_vault'))
