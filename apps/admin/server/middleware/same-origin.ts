// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineEventHandler(event => {
  if (!getRequestURL(event).pathname.startsWith('/api/')) return
  if (['GET','HEAD','OPTIONS'].includes(getMethod(event))) return
  const site = getRequestHeader(event, 'sec-fetch-site')
  const origin = getRequestHeader(event, 'origin')
  if (site === 'cross-site' || site === 'same-site' || (origin && origin !== getRequestURL(event).origin)) {
    throw createError({statusCode: 403, statusMessage: 'Yêu cầu khác nguồn không được phép'})
  }
})
