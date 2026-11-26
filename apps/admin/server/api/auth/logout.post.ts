// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { adminSession } from '../../utils/session'
export default defineEventHandler(async event => {await adminSession.logout(event); return {ok: true}})
