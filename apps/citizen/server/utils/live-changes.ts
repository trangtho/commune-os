// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// A single PostgreSQL LISTEN connection is shared across browser SSE clients.
import type { PoolClient, Notification } from 'pg'
import { db } from './database'

export type LiveResource = 'procedures' | 'applications' | 'notifications' | 'profile'
export type LiveChange = { resource: LiveResource; citizenId?: string; tenantId?: string }
type Observer = (change: LiveChange | { resource: 'offline' | 'online' }) => void
const CHANNEL = 'communeos_citizen_changes'
const observers = new Set<Observer>()
let listening: PoolClient | null = null
let connecting: Promise<void> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

function publish(change: LiveChange | { resource: 'offline' | 'online' }) {
  for (const observer of observers) {
    try { observer(change) } catch (error) { console.warn('[live] Observer error', error) }
  }
}
function onNotification(message: Notification) {
  if (message.channel !== CHANNEL || !message.payload) return
  try {
    const change = JSON.parse(message.payload) as LiveChange
    if (!['procedures', 'applications', 'notifications', 'profile'].includes(change.resource)) return
    if (change.resource !== 'procedures' && (!change.citizenId || !change.tenantId)) return
    publish(change)
  } catch { /* untrusted payload: do not forward */ }
}
function onConnectionLost(client: PoolClient) {
  if (listening !== client) return
  listening = null
  client.removeListener('notification', onNotification)
  client.removeListener('error', onClientError)
  client.removeListener('end', onClientEnd)
  try { client.release(true) } catch { /* disconnected already */ }
  publish({ resource: 'offline' })
  scheduleReconnect()
}
function onClientError(this: PoolClient) { onConnectionLost(this) }
function onClientEnd(this: PoolClient) { onConnectionLost(this) }
function scheduleReconnect() {
  if (!observers.size || reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void ensureListener().catch((error) => {
      console.warn('[live] PostgreSQL LISTEN retry failed:', error instanceof Error ? error.message : 'unknown')
      scheduleReconnect()
    })
  }, 3_000)
}
async function ensureListener(): Promise<void> {
  if (listening) return
  if (connecting) return connecting
  connecting = (async () => {
    const client = await db().connect()
    client.on('error', onClientError)
    client.on('end', onClientEnd)
    try {
      await client.query(`LISTEN ${CHANNEL}`)
      listening = client
      client.on('notification', onNotification)
      publish({ resource: 'online' })
    } catch (error) {
      client.removeListener('error', onClientError)
      client.removeListener('end', onClientEnd)
      client.release(true)
      throw error
    }
  })().finally(() => { connecting = null })
  return connecting
}
function scheduleIdleRelease() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    idleTimer = null
    if (observers.size || !listening) return
    const client = listening
    listening = null
    client.removeListener('notification', onNotification)
    client.removeListener('error', onClientError)
    client.removeListener('end', onClientEnd)
    void client.query(`UNLISTEN ${CHANNEL}`)
      .catch(() => undefined).finally(() => client.release())
  }, 5_000)
}
export async function observeLiveChanges(observer: Observer): Promise<() => void> {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null }
  observers.add(observer)
  try { await ensureListener() } catch (error) { observers.delete(observer); throw error }
  return () => {
    observers.delete(observer)
    if (!observers.size) {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      scheduleIdleRelease()
    }
  }
}
