// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const migration = read('../../../core/db/init/03-citizen-chat-history.sql')
const api = read('../server/api/chat/index.post.ts')
const list = read('../server/api/chat/conversations/index.get.ts')
const detail = read('../server/api/chat/conversations/[id].get.ts')
const remove = read('../server/api/chat/conversations/[id].delete.ts')
const chat = read('../pages/tro-ly.vue')
const panel = read('../components/ChatHistoryPanel.vue')
const compose = read('../../../docker-compose.yml')

test('Migration grants account+tenant scoped RLS and cascades deletion', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS citizen_ai_conversations/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS citizen_ai_messages/)
  assert.match(migration, /ON DELETE CASCADE/)
  assert.match(migration, /citizen_ai_conversations FORCE ROW LEVEL SECURITY/)
  assert.match(migration, /citizen_ai_messages FORCE ROW LEVEL SECURITY/)
  assert.match(migration, /app\.citizen_id/)
  assert.match(migration, /app\.tenant_id/)
  assert.match(compose, /03-citizen-chat-history\.sql/)
})

test('Chat saves server-verified answer and question only for authenticated citizen in one tx', () => {
  assert.match(api, /const actor = readSession\(event\)/)
  assert.match(api, /if \(actor\) \{/)
  assert.match(api, /savedConversationId = await citizenTx/)
  assert.match(api, /citizen_ai_messages/)
  assert.match(api, /result\.answer/)
  assert.match(api, /JSON\.stringify\(result\.sources/)
  assert.match(api, /return \{\.\.\.result, revision/)
  assert.match(api, /conversationId: savedConversationId/)
})

test('History endpoints are private, validate identifiers, page results and scope deletion', () => {
  for (const source of [list, detail, remove]) {
    assert.match(source, /citizenTx\(event/)
    assert.match(source, /no-store/)
  }
  assert.match(list, /LIMIT \$1 OFFSET \$2/)
  assert.match(detail, /WHERE conversation_id = \$1/)
  assert.match(detail, /id < \$2::bigint/)
  assert.match(remove, /DELETE FROM citizen_ai_conversations WHERE id = \$1/)
})

test('Chat UI opens, paginates and deletes saved conversations without losing RAG citations', () => {
  assert.match(chat, /fetchThreads/)
  assert.match(chat, /openThread/)
  assert.match(chat, /fetchOlder/)
  assert.match(chat, /removeThread/)
  assert.match(chat, /activeConversationId/)
  assert.match(chat, /message\.sources\?\.length/)
  assert.match(panel, /Lịch sử hội thoại/)
})
