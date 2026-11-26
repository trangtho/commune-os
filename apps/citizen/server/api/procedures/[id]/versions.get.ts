// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Các phiên bản và nguồn văn bản của một thủ tục đã công bố (api.public_procedure_versions của lõi).
import {publicRpc} from '../../../utils/identity'
export default defineEventHandler(event=>{
 setHeader(event,'Cache-Control','no-store')
 return publicRpc('public_procedure_versions',{p_procedure_id:String(getRouterParam(event,'id')||'')})
})
