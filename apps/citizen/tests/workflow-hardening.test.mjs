// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = path => readFileSync(resolve(root, path), 'utf8')

test('Database migration grants the minimum UPDATE columns needed for editing and submission', () => {
  const sql = read('core/db/init/01-schema.sql')
  assert.match(sql, /GRANT UPDATE \(status, updated_at, applicant_name, applicant_phone,[\s\S]*description, form_data, submitted_at, due_at\) ON applications TO communeos_app/)
  assert.doesNotMatch(sql, /GRANT UPDATE \([^)]*(?:citizen_id|tenant_id)[^)]*\) ON applications TO communeos_app/)
  assert.match(sql, /ALTER TABLE applications ALTER COLUMN submitted_at DROP NOT NULL/)
  assert.match(sql, /UPDATE applications SET submitted_at=NULL, due_at=NULL WHERE status='draft'/)
  const create = read('apps/citizen/server/api/applications/index.post.ts')
  assert.match(create, /'draft',[^\n]*NULL,NULL/)
  const submit = read('apps/citizen/server/api/applications/[id]/submit.post.ts')
  assert.match(submit, /submitted_at=now\(\),updated_at=now\(\),due_at=CURRENT_DATE/)
})

test('Draft editor loads saved state before rendering and prevents direct step bypass', () => {
  const editor = read('apps/citizen/pages/nop-ho-so/[slug].vue')
  assert.match(editor, /await useAsyncData<Application \| null>/)
  assert.match(editor, /existingDraft\.value\?\.status !== 'draft'/)
  assert.match(editor, /existingDraft\.value\?\.procedure_id !== slug/)
  assert.match(editor, /if \(next > 1 && !draftId\.value\) return/)
  assert.match(editor, /if \(next === 3 && missing\.value\.length\) return/)
  assert.match(editor, /confirmed\.value = false/)
  const api = read('apps/citizen/server/api/applications/[id]/submit.post.ts')
  assert.match(api, /if\(missing\.length\)throw createError\(\{statusCode:422/)
})

test('File upload is type checked and bounded, and supplementary uploads require new attachments', () => {
  const upload = read('apps/citizen/server/api/applications/[id]/documents.post.ts')
  assert.match(upload, /file\.data\.length>5\*1024\*1024/)
  assert.match(upload, /FOR UPDATE/)
  assert.match(upload, /if\(count>=30\)/)
  const supplement = read('apps/citizen/pages/ho-so/[id]/bo-sung.vue')
  assert.match(supplement, /lastSupplementTime/)
  assert.match(supplement, /!hasNewDocuments/)
})

test('Usability, live badges and printing survive the fixed viewport', () => {
  const layout = read('apps/citizen/layouts/default.vue')
  assert.match(layout, /unreadCount/)
  assert.match(layout, /mobileExtras/)
  assert.match(layout, /Hỗ trợ công dân/)
  assert.match(layout, /to="\/tro-ly"/)
  const live = read('apps/citizen/plugins/live-updates.client.ts')
  assert.match(live, /'citizen-notifications-badge'/)
  assert.match(live, /'citizen-applications-home'/)
  const css = read('apps/citizen/assets/css/main.css')
  assert.match(css, /@media print[\s\S]*height: auto !important/)
  assert.ok(existsSync(resolve(root, 'apps/citizen/error.vue')))
  const search = read('apps/citizen/utils/search.ts')
  assert.match(search, /normalize\('NFD'\)/)
  assert.match(search, /\[đĐ\]/)
})
