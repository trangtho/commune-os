// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lộ trình sự kiện cuộc sống công dân đã lưu (api.citizen_journeys của lõi).
import {citizenRpc} from '../../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenRpc(event,'citizen_journeys')
})
