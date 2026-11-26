// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Origin is set by the operator, never inferred from untrusted forwarding headers.
export function portalOrigin(requestUrl: URL, configured = process.env.PORTAL_PUBLIC_ORIGIN || ''): URL {
  if (!configured.trim()) return new URL(requestUrl.origin)
  const raw = configured.trim()
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || !/^https?:\/\/[^/?#\s\\]+\/?$/i.test(raw)) {
    throw new Error('PORTAL_PUBLIC_ORIGIN must be a single HTTP(S) origin')
  }
  return new URL(url.origin)
}

// Only loopback and RFC1918 IPv4 literals qualify; DNS names and public IPs do not.
export function isLocalPortalHost(host: string): boolean {
  if (host === 'localhost' || host === '[::1]') return true
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
  const [a, b, c, d] = host.split('.').map(Number)
  if ([a, b, c, d].some(n => n > 255)) return false
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

export function securePortalCookie(url: URL, allowLocalHttp = process.env.PORTAL_ALLOW_LOCAL_HTTP === 'true', configured = process.env.PORTAL_PUBLIC_ORIGIN || ''): boolean {
  const external = portalOrigin(url, configured)
  // Never downgrade an HTTPS request, even if the configured origin is HTTP.
  return !(allowLocalHttp && url.protocol === 'http:' && isLocalPortalHost(url.hostname) && external.protocol === 'http:' && isLocalPortalHost(external.hostname))
}

export function isSamePortalOrigin(url: URL, origin: string | undefined, site: string | undefined, configured = process.env.PORTAL_PUBLIC_ORIGIN || ''): boolean {
  const expected = portalOrigin(url, configured).origin
  // Keep rejecting cross-origin browser mutations, including sibling subdomains/ports.
  return site !== 'cross-site' && site !== 'same-site' && (origin === undefined || origin === expected)
}
