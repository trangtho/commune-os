// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// PostgreSQL NOTIFY -> authenticated SSE -> selective Nuxt data refresh for staff.
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
    if (resource === 'applications') {
      const keys = ['staff-applications']
      if (route.path.startsWith('/ho-so/') && typeof route.params.id === 'string')
        keys.push(`staff-application:${route.params.id}`)
      return keys
    }
    if (resource === 'procedures') return ['staff-procedures']
    if (resource === 'notifications') return ['staff-notifications']
    if (resource === 'staff') return ['staff-list', 'staff-auth']
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
    }, 250)
  }
  function reconcile() {
    lastReconcile = Date.now()
    for (const resource of ['applications', 'procedures', 'notifications', 'staff']) scheduleRefresh(resource)
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
    fallbackTimer = setInterval(() => {
      if (document.hidden) return
      if (!online || Date.now() - lastHeartbeat > 60_000 || Date.now() - lastReconcile > 60_000) reconcile()
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
    watch(() => router.currentRoute.value.path, () => { reconcile(); connect() })
  })
})
