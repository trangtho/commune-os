// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  const { gatewayUrl, keycloakUrl } = useRuntimeConfig(event)
  try {
    const [catalog] = await Promise.all([
      $fetch<unknown[]>(`${gatewayUrl}/public/rpc/procedure_catalog`, {method: 'POST', body: {}, timeout: 3500, retry: 0}),
      $fetch(`${keycloakUrl}/realms/communeos/.well-known/openid-configuration`, {timeout: 3500, retry: 0}),
    ])
    if (!Array.isArray(catalog)) throw new Error('Invalid catalog')
    return {ok: true, service: 'commune', core: 'APISIX → PostgREST'}
  } catch {
    setResponseStatus(event, 503)
    return {ok: false, service: 'commune', core: 'APISIX → PostgREST', errorCode: 'CORE_UNAVAILABLE'}
  }
})
