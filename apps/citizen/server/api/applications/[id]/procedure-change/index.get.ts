// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {citizenTx} from '../../../../utils/database'
import {procedureDraftChange} from '../../../../utils/procedure-version'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 setHeader(event,'Cache-Control','private, no-store')
 return procedureDraftChange(client,String(getRouterParam(event,'id')))
}))
