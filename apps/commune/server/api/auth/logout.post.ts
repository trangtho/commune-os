// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { logoutStaff } from '../../utils/session'
export default defineEventHandler(async event => {await logoutStaff(event); return {ok:true}})
