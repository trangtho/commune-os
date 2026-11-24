// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Staff publishes slots separately. No fake/generated availability (api.citizen_consultation_slots của lõi).
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event => citizenRpc(event,'citizen_consultation_slots',{p_category:String(getQuery(event).category || '').trim().slice(0,80)}))
