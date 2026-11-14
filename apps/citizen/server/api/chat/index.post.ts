// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { getRequestIP, setHeader } from 'h3'
import { readSession } from '../../utils/session'
import { citizenTx } from '../../utils/database'
import { messageSchema, validate } from '../../utils/validation'
import { loadPublishedKnowledge } from '../../utils/procedure-knowledge'
import { classifyWithRagService } from '../../utils/ai-classifier'
import { retrieveKnowledge } from '../../utils/knowledge-index'
import { answerWithIndexedRag } from '../../utils/rag-answer'
import { buildGroundedAnswer, detectAnswerFields, isCatalogQuestion, isOutOfScope, rankProcedures } from '../../../shared/ai-knowledge'

// A modest in-process limit to reduce public endpoint abuse; for multi-instance
// deployments configure an upstream shared rate limiter in the gateway as well.
const visitorRequests = new Map<string, {start: number; count: number}>()
function checkRate(ip: string) {
  const now = Date.now()
  if (visitorRequests.size > 4096) {
    for (const [key, value] of visitorRequests) if (now - value.start > 60_000) visitorRequests.delete(key)
  }
  const old = visitorRequests.get(ip)
  const entry = old && now - old.start < 60_000 ? old : {start: now, count: 0}
  entry.count += 1
  visitorRequests.set(ip, entry)
  if (entry.count > 20) throw createError({statusCode: 429, statusMessage: 'Bạn đang gửi quá nhiều câu hỏi. Vui lòng thử lại sau một phút.'})
}
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  checkRate(getRequestIP(event, {xForwardedFor: false}) || 'unidentified')
  const raw = await readBody(event)
  const body = validate(messageSchema, raw)
  const contextId = typeof raw?.procedureId === 'string' ? String(raw.procedureId) : ''
  if (contextId && !/^[a-z0-9-]{2,80}$/.test(contextId)) throw createError({statusCode:400,statusMessage:'Thủ tục không hợp lệ'})
  // The current conversation is not trusted from the client: check ownership
  // before retrieving knowledge and again inside the transaction that stores the answer.
  const actor = readSession(event)
  const conversationId = typeof raw?.conversationId === 'string' ? raw.conversationId : ''
  if (raw?.conversationId !== undefined && (!conversationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)))
    throw createError({statusCode:400,statusMessage:'Mã cuộc trò chuyện không hợp lệ'})
  if (conversationId && !actor) throw createError({statusCode:401,statusMessage:'Vui lòng đăng nhập để mở lại cuộc trò chuyện'})
  if (conversationId) {
    await citizenTx(event, async client => {
      const found = await client.query('SELECT 1 FROM citizen_ai_conversations WHERE id = $1', [conversationId])
      if (!found.rowCount) throw createError({statusCode:404,statusMessage:'Không tìm thấy cuộc trò chuyện của bạn'})
    })
  }

  try {
    const {catalog, faq, revision} = await loadPublishedKnowledge()
    // If a context is provided it MUST still be a published procedure; no guessing.
    if (contextId && !catalog.some(p => p.id === contextId)) throw createError({statusCode:404,statusMessage:'Thủ tục không có trong danh mục đang công bố'})
    const selectedContext = contextId
    const matches = isCatalogQuestion(body.message) || isOutOfScope(body.message) ? [] : rankProcedures(body.message, catalog, selectedContext)
    const selection = isCatalogQuestion(body.message) || isOutOfScope(body.message) ? null : await classifyWithRagService(body.message, matches)
    let result = buildGroundedAnswer(body.message, catalog, {
      contextId: selectedContext, faq,
      selectedIds: selection?.selectedIds,
      requestedFields: selection?.requestedFields,
      aiUsed: !!selection
    })
    // The index is an acceleration and retrieval layer only. Its citations
    // must agree with the canonical, freshly loaded catalog response.
    let indexReady = false
    if (result.mode !== 'INSUFFICIENT' && !isCatalogQuestion(body.message)) {
      const retrieval = await retrieveKnowledge(body.message, contextId)
      indexReady = retrieval.ready
      const allowedSources = new Set(result.sources.map(source => source.id))
      const fields = detectAnswerFields(body.message)
      const unsupportedFields = fields.includes('authority') || fields.includes('eligibility')
      const trustedChunks = retrieval.chunks.filter(chunk =>
        allowedSources.has(chunk.procedure_id ? `procedure:${chunk.procedure_id}` : chunk.id)
        && (chunk.field === 'faq' || chunk.field === 'title' || chunk.field === 'category'
          || fields.some(field => ({fee:'fee',duration:'duration',documents:'documents',instructions:'instructions',summary:'summary'} as Record<string,string>)[field] === chunk.field))
      )
      if (!unsupportedFields && trustedChunks.length) {
        const generated = await answerWithIndexedRag(body.message, trustedChunks)
        if (generated && generated.sources.every(source => allowedSources.has(source.id))) {
          result = {...generated, suggestions: result.suggestions}
        }
      }
    }
    let savedConversationId: string | null = null
    if (actor) {
      // Save the citizen's question and the VERIFIED answer as one transaction;
      // chat content is never inserted into the public RAG knowledge index.
      savedConversationId = await citizenTx(event, async (client, owner) => {
        let id = conversationId
        if (id) {
          const owned = await client.query('SELECT id FROM citizen_ai_conversations WHERE id = $1 FOR UPDATE', [id])
          if (!owned.rowCount) throw createError({statusCode:404,statusMessage:'Không tìm thấy cuộc trò chuyện của bạn'})
        } else {
          const title = body.message.trim().slice(0, 100)
          const created = await client.query<{id:string}>(
            `INSERT INTO citizen_ai_conversations(citizen_id,tenant_id,title)
             VALUES($1,$2,$3) RETURNING id`, [owner.id, owner.tenantId, title])
          id = created.rows[0]!.id
        }
        await client.query(
          `INSERT INTO citizen_ai_messages(conversation_id,citizen_id,tenant_id,role,content)
           VALUES($1,$2,$3,'citizen',$4)`, [id, owner.id, owner.tenantId, body.message])
        await client.query(
          `INSERT INTO citizen_ai_messages
            (conversation_id,citizen_id,tenant_id,role,content,mode,sources,suggestions,notice,revision)
           VALUES($1,$2,$3,'assistant',$4,$5,$6::jsonb,$7::jsonb,$8,$9)`,
          [id, owner.id, owner.tenantId, result.answer, result.mode,
            JSON.stringify(result.sources ?? []), JSON.stringify(result.suggestions ?? []),
            result.notice ?? null, revision])
        await client.query('UPDATE citizen_ai_conversations SET updated_at = now() WHERE id = $1', [id])
        return id
      })
    }
    return {...result, revision, knowledgeSource: 'published_procedures', updatedOn: 'per_request', indexReady,
      conversationId: savedConversationId, saved: !!savedConversationId}
  } catch(error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[citizen-chat] Database knowledge unavailable', error instanceof Error ? error.message : 'unknown')
    throw createError({statusCode:503,statusMessage:'Không thể truy cập dữ liệu thủ tục lúc này. Trợ lý sẽ không đưa ra thông tin chưa được xác thực.'})
  }
})
