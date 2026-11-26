// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lịch tư vấn của công dân (api.citizen_consultations của lõi).
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event => citizenRpc(event,'citizen_consultations'))
