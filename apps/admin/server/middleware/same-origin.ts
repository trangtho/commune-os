// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { isSamePortalOrigin } from '../utils/cookie-policy'

export default defineEventHandler(event => {
  const url = getRequestURL(event, {xForwardedHost: false, xForwardedProto: false})
  if (!url.pathname.startsWith('/api/')) return
  if (['GET','HEAD','OPTIONS'].includes(getMethod(event))) return
  const site = getRequestHeader(event, 'sec-fetch-site')
  const origin = getRequestHeader(event, 'origin')
  if (!isSamePortalOrigin(url, origin, site)) {
    throw createError({statusCode: 403, statusMessage: 'Yêu cầu khác nguồn không được phép'})
  }
})
