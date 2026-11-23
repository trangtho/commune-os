// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = path => readFileSync(resolve(root, path), 'utf8')
const core = read('core/db/init/21-citizen-api-core-flow.sql')

test('Database migration grants the minimum UPDATE columns needed for editing and submission', () => {
  const sql = read('core/db/init/01-schema.sql')
  assert.match(sql, /GRANT UPDATE \(status, updated_at, applicant_name, applicant_phone,[\s\S]*description, form_data, submitted_at, due_at\) ON applications TO communeos_app/)
  assert.doesNotMatch(sql, /GRANT UPDATE \([^)]*(?:citizen_id|tenant_id)[^)]*\) ON applications TO communeos_app/)
  assert.match(sql, /ALTER TABLE applications ALTER COLUMN submitted_at DROP NOT NULL/)
  assert.match(sql, /UPDATE applications SET submitted_at=NULL, due_at=NULL WHERE status='draft'/)
  assert.match(core, /'draft', p_applicant_name,[\s\S]*?NULL, NULL, v_receiving/)
  assert.match(core, /submitted_at = now\(\), updated_at = now\(\),\s*due_at = CURRENT_DATE/)
})

test('Draft editor loads saved state before rendering and prevents direct step bypass', () => {
  const editor = read('apps/citizen/pages/nop-ho-so/[slug].vue')
  assert.match(editor, /await useAsyncData<Application \| null>/)
  assert.match(editor, /existingDraft\.value\?\.status !== 'draft'/)
  assert.match(editor, /existingDraft\.value\?\.procedure_id !== slug/)
  assert.match(editor, /if \(next > 1 && !draftId\.value\) return/)
  assert.match(editor, /refreshPreflight\(\)/)
  assert.match(editor, /!preflight\?\.ready/)
  assert.match(editor, /confirmed\.value = false/)
  assert.match(core, /IF v_missing IS NOT NULL THEN PERFORM public\.citizen_fail\(422/)
})

test('File upload is type checked and bounded, and supplementary uploads require new attachments', () => {
  const upload = read('apps/citizen/server/api/applications/[id]/documents.post.ts')
  assert.match(upload, /file\.data\.length>5\*1024\*1024/)
  assert.match(upload, /citizen_document_add/)
  assert.match(core, /FROM applications WHERE id = p_application_id FOR UPDATE;\s*IF v_status IS NULL OR v_status NOT IN \('draft', 'supplement'\)/)
  assert.match(core, /WHERE application_id = p_application_id\) >= 30/)
  const supplement = read('apps/citizen/pages/ho-so/[id]/bo-sung.vue')
  assert.match(supplement, /lastSupplementTime/)
  assert.match(supplement, /hasStructured\.value\?completeItems\.value:hasNewDocuments\.value/)
  assert.match(supplement, /saveItem\(item/)
})

test('Usability, live badges and printing survive the fixed viewport', () => {
  const layout = read('apps/citizen/layouts/default.vue')
  assert.match(layout, /unreadCount/)
  assert.match(layout, /mobileExtras/)
  assert.match(layout, /to:'\/tro-ly',name:'Trợ lý AI'/)
  assert.match(layout, /to:'\/lien-he',name:'Liên hệ hỗ trợ'/)
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
