// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { startOidc } from '../../../utils/oidc'
export default defineEventHandler(event => {
  const next=typeof getQuery(event).next==='string'?getQuery(event).next as string:'/'
  return sendRedirect(event,startOidc(event,next),302)
})
