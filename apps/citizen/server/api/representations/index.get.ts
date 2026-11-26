// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Đăng ký đại diện của công dân (api.citizen_representations của lõi).
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event => citizenRpc(event,'citizen_representations'))
