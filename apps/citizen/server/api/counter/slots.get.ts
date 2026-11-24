// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Khung giờ một cửa do cán bộ công bố, còn chỗ (api.citizen_counter_slots của lõi).
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event=>citizenRpc(event,'citizen_counter_slots',{p_procedure_id:String(getQuery(event).procedureId||'').trim().slice(0,100)}))
