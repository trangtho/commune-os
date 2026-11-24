// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Góp ý của chính công dân (api.citizen_feedback của lõi; RLS theo công dân và xã).
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event => citizenRpc(event,'citizen_feedback'))
