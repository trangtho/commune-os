// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Cookies remain Secure unless local HTTP is explicitly enabled for loopback.
export function securePortalCookie(url: URL, allowLocalHttp = process.env.PORTAL_ALLOW_LOCAL_HTTP === 'true'): boolean {
  return !(allowLocalHttp && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
}
