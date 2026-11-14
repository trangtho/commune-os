// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// PostgreSQL NOTIFY -> authenticated SSE -> selective Nuxt data refresh.
// Missed signals are reconciled by a slower background check (never window.reload).
export default defineNuxtPlugin(() => {
  const router = useRouter()
  let source: EventSource | null = null
  let online = false
  let lastHeartbeat = 0
  let lastReconcile = 0
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let fallbackTimer: ReturnType<typeof setInterval> | null = null
  const pending = new Set<string>()

  function selectKeys(resource: string): string[] {
    const route = router.currentRoute.value
    if (resource === 'procedures') {
      const keys = ['citizen-procedures']
      if (route.path.startsWith('/thu-tuc/') || route.path.startsWith('/nop-ho-so/'))
        keys.push(`citizen-procedure:${String(route.params.slug)}`)
      return keys
    }
    if (resource === 'applications') {
      const keys = ['citizen-applications', 'citizen-applications-home']
      if (route.path.startsWith('/ho-so/') && typeof route.params.id === 'string')
        keys.push(`citizen-application:${route.params.id}`)
      return keys
    }
    if (resource === 'notifications') return ['citizen-notifications', 'citizen-notifications-badge']
    if (resource === 'profile') return ['citizen-profile', 'citizen-auth', 'citizen-auth-home']
    return []
  }
  function scheduleRefresh(resource: string) {
    for (const key of selectKeys(resource)) pending.add(key)
    if (refreshTimer) return
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      const keys = [...pending]
      pending.clear()
      if (keys.length) void refreshNuxtData(keys).catch(() => undefined)
    }, 250) // Batch several changes in the same database transaction.
  }
  function reconcile() {
    lastReconcile = Date.now()
    for (const resource of ['procedures', 'applications', 'notifications', 'profile']) scheduleRefresh(resource)
  }
  function disconnect() {
    source?.close()
    source = null
    online = false
  }
  function connect() {
    disconnect()
    if (document.hidden || !navigator.onLine) return
    const events = new EventSource('/api/live', { withCredentials: true })
    source = events
    events.addEventListener('status', (e) => {
      const status = JSON.parse((e as MessageEvent).data) as { status?: string }
      online = status.status === 'online'
      lastHeartbeat = Date.now()
      if (online) reconcile()
    })
    events.addEventListener('heartbeat', () => { lastHeartbeat = Date.now() })
    events.addEventListener('change', (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { resource?: string }
        if (data.resource) scheduleRefresh(data.resource)
      } catch { /* invalid signal */ }
    })
    events.onerror = () => { online = false }
  }
  onNuxtReady(() => {
    connect()
    // Always reconcile occasionally; retry quickly if SSE is down/stale.
    fallbackTimer = setInterval(() => {
      if (document.hidden) return
      if (!online || Date.now() - lastHeartbeat > 60_000 || Date.now() - lastReconcile > 60_000) reconcile()
      // Periodic reconciliation even on healthy SSE covers missed notifications.
    }, 15_000)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) disconnect()
      else { reconcile(); connect() }
    })
    window.addEventListener('online', () => { reconcile(); connect() })
    window.addEventListener('offline', disconnect)
    window.addEventListener('beforeunload', () => {
      disconnect()
      if (fallbackTimer) clearInterval(fallbackTimer)
      if (refreshTimer) clearTimeout(refreshTimer)
    })
    // Reconnect after login/logout, since privileges are fixed at SSE handshake.
    watch(() => router.currentRoute.value.path, () => { reconcile(); connect() })
  })
})
