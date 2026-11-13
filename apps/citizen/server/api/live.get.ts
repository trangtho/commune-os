// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { createEventStream, setHeader } from 'h3'
import { readSession } from '../utils/session'
import { observeLiveChanges } from '../utils/live-changes'

// Anonymous viewers receive only public procedure invalidations.
// Authenticated viewers receive only events matching their own citizen & tenant IDs.
export default defineEventHandler(async (event) => {
  const citizen = readSession(event)
  setHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setHeader(event, 'X-Accel-Buffering', 'no')
  const stream = createEventStream(event)
  let closed = false
  const push = (name: string, data: object) => {
    if (closed) return
    void stream.push({ event: name, data: JSON.stringify(data) }).catch(() => undefined)
  }
  const unsubscribe = await observeLiveChanges((change) => {
    if (change.resource === 'offline' || change.resource === 'online') {
      push('status', { status: change.resource })
      return
    }
    if (change.resource !== 'procedures' &&
      (!citizen || change.citizenId !== citizen.id || change.tenantId !== citizen.tenantId)) return
    // Never broadcast case IDs, names, documents or other citizen data via SSE.
    push('change', { resource: change.resource })
  })
  const heartbeat = setInterval(() => push('heartbeat', { t: Date.now() }), 25_000)
  push('status', { status: 'online' })
  stream.onClosed(() => {
    closed = true
    clearInterval(heartbeat)
    unsubscribe()
  })
  return stream.send()
})
