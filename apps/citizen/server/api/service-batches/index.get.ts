// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Các nhóm thủ tục nộp cùng lúc của công dân (api.citizen_service_batches của lõi).
import { citizenRpc } from '../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenRpc(event,'citizen_service_batches')
})
