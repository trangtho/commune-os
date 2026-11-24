// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Xóa tùy chọn cá nhân hóa (api.citizen_preferences_delete của lõi).
import {citizenRpc} from '../../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenRpc(event,'citizen_preferences_delete')
})
