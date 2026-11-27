// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  const { gatewayUrl, keycloakUrl } = useRuntimeConfig(event)
  try {
    const [platform] = await Promise.all([
      $fetch<{ modules: unknown[] }>(`${gatewayUrl}/public/rpc/public_platform`, {timeout: 3500, retry: 0}),
      $fetch(`${keycloakUrl}/realms/communeos/.well-known/openid-configuration`, {timeout: 3500, retry: 0}),
    ])
    if (!Array.isArray(platform?.modules)) throw new Error('Invalid platform response')
    return {ok: true, service: 'admin', core: 'APISIX → PostgREST'}
  } catch {
    setResponseStatus(event, 503)
    return {ok: false, service: 'admin', core: 'APISIX → PostgREST', errorCode: 'CORE_UNAVAILABLE'}
  }
})
