// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFileSync(resolve(root, file), 'utf8')

test('Header removes redundant notification nav button and retains clickable bell preview', () => {
  const layout = read('layouts/default.vue')
  const nav = layout.match(/const nav=\[([^\n]+)\]/)?.[1] || ''
  assert.doesNotMatch(nav, /to:'\/thong-bao'/)
  assert.match(layout, /<NotificationPopover\b/)
  assert.match(layout, /:unread-count="unreadCount"/)
  assert.doesNotMatch(layout, /<NuxtLink to="\/thong-bao" class="relative rounded-lg/)
})

test('The notification bell exposes a responsive, keyboard accessible popover', () => {
  const ui = read('components/NotificationPopover.vue')
  assert.match(ui, /aria-controls="citizen-notification-popover"/)
  assert.match(ui, /:aria-expanded="opened"/)
  assert.match(ui, /aria-haspopup="dialog"/)
  assert.match(ui, /@keydown\.esc\.stop="close\(true\)"/)
  assert.match(ui, /pointerdown', handleOutside/)
  assert.match(ui, /watch\(\(\) => route\.fullPath/)
  assert.match(ui, /w-\[calc\(100vw-1\.5rem\)\]/)
  assert.match(ui, /max-h-\[min\(48dvh,320px\)\]/)
})

test('Notification actions use existing secured endpoints and refresh page and badge', () => {
  const ui = read('components/NotificationPopover.vue')
  assert.match(ui, /\/api\/notifications\/\$\{encodeURIComponent\(id\)\}\/read/)
  assert.match(ui, /\/api\/notifications\/read-all/)
  assert.match(ui, /refreshNuxtData\(\['citizen-notifications-badge', 'citizen-notifications-page'\]\)/)
  assert.match(ui, /to="\/thong-bao"/)
  assert.match(ui, /:to="`\/ho-so\/\$\{notice\.application_id\}`"/)
  assert.match(ui, /if \(!props\.authenticated \|\| pendingId\.value\) return/)
})

test('Counter uses server total unread count, while preview is bounded to recent items', () => {
  const layout = read('layouts/default.vue')
  const ui = read('components/NotificationPopover.vue')
  assert.match(layout, /query:\{paged:'1',page:'1'\}/)
  assert.match(layout, /headerNotices\.value\?\.unreadCount\|\|0/)
  assert.match(ui, /props\.notices\.slice\(0, 5\)/)
  assert.match(ui, /v-if="!authenticated"/)
})
