// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
import { reviewStoredDraft } from '../../../utils/preflight'
export default defineEventHandler(event=>citizenTx(event,(client,actor)=>reviewStoredDraft(client,actor,String(getRouterParam(event,'id')||''))))
