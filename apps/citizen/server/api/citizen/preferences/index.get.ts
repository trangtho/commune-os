// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tùy chọn cá nhân hóa (api.citizen_preferences của lõi).
import {citizenRpc} from '../../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenRpc(event,'citizen_preferences')
})
