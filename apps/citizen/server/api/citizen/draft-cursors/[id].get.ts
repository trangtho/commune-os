// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Bước đang soạn của bản nháp (api.citizen_draft_cursor của lõi).
import {citizenRpc} from '../../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','private, no-store')
 return citizenRpc(event,'citizen_draft_cursor',{p_application_id:String(getRouterParam(event,'id')||'')})
})
