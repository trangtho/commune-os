// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { revokeTokens } from '../../utils/identity'
import { signOut } from '../../utils/session'
export default defineEventHandler(async (event) => {
  await revokeTokens(event)
  signOut(event)
  return { ok: true }
})
