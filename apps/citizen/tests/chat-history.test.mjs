// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const migration = read('../../../modules/xa/db/03-citizen-chat-history.sql')
const api = read('../server/api/chat/index.post.ts')
const list = read('../server/api/chat/conversations/index.get.ts')
const detail = read('../server/api/chat/conversations/[id].get.ts')
const remove = read('../server/api/chat/conversations/[id].delete.ts')
const chat = read('../pages/tro-ly.vue')
const panel = read('../components/ChatHistoryPanel.vue')
// Lưu, đọc, xóa lịch sử trò chuyện là API của lõi (gọi qua cổng bằng token công dân).
const supportApi = read('../../../modules/xa/db/31-citizen-api-support.sql')
const fn = name => supportApi.slice(supportApi.indexOf(`FUNCTION api.${name}(`)).split('END $$;')[0]
const compose = read('../../../modules/xa/module.json')

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
  assert.match(api, /citizenRpc<\{conversationId:string\}>\(event, 'citizen_chat_save'/)
  assert.match(api, /p_answer: result\.answer/)
  assert.match(api, /p_sources: result\.sources/)
  // Câu hỏi và câu trả lời ghi trong cùng một hàm (một giao dịch) của lõi.
  assert.match(fn('citizen_chat_save'), /'citizen', p_question\);[\s\S]*'assistant', p_answer/)
  assert.match(api, /return \{\.\.\.result, revision/)
  assert.match(api, /conversationId: savedConversationId/)
})

test('History endpoints are private, validate identifiers, page results and scope deletion', () => {
  for (const source of [list, detail, remove]) {
    assert.match(source, /citizenRpc(<[^>]+>)?\(event, 'citizen_chat_conversation/)
    assert.match(source, /no-store/)
  }
  assert.match(fn('citizen_chat_conversations'), /LIMIT 20 OFFSET \(p_page - 1\) \* 20/)
  assert.match(fn('citizen_chat_conversation'), /WHERE conversation_id = p_conversation_id AND \(p_before IS NULL OR id < p_before\)/)
  assert.match(fn('citizen_chat_conversation_delete'), /DELETE FROM citizen_ai_conversations WHERE id = p_conversation_id/)
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
