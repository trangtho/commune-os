// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { getRequestIP, setHeader } from 'h3'
import { readSession } from '../../utils/session'
import { publicQuery } from '../../utils/database'
import { citizenRpc } from '../../utils/identity'
import { messageSchema, validate } from '../../utils/validation'
import { loadPublishedKnowledge } from '../../utils/procedure-knowledge'
import { retrieveKnowledge } from '../../utils/knowledge-index'
import { askCoreAi, semanticProcedure } from '../../utils/core-ai'
import { composeExtractiveAnswer, type IndexedChunk } from '../../../shared/rag-evidence'
import {groupQuestionTopic} from '../../../shared/citizen-intelligence.mjs'
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
  if (conversationId) await citizenRpc(event, 'citizen_chat_conversation_check', {p_conversation_id: conversationId})

  try {
    const published = await loadPublishedKnowledge()
    const {faq, revision} = published
    // Công dân đã đăng nhập chỉ được trả lời về thủ tục xã mình đang mở; khách xem danh mục đã công bố.
    const enabledIds = actor ? new Set(await citizenRpc<string[]>(event, 'citizen_enabled_procedures')) : null
    const catalog = enabledIds ? published.catalog.filter(p => enabledIds.has(p.id)) : published.catalog
    // If a context is provided it MUST still be a published procedure; no guessing.
    if (contextId && !catalog.some(p => p.id === contextId)) throw createError({statusCode:404,statusMessage:'Thủ tục không có trong danh mục đang công bố'})
    const generalQuestion = isCatalogQuestion(body.message) || isOutOfScope(body.message)
    const matches = generalQuestion ? [] : rankProcedures(body.message, catalog, contextId)
    // Trợ lý AI của lõi (mô hình chạy cục bộ): tìm kiếm lai toàn văn + ngữ nghĩa, mô hình chọn trích dẫn nguyên văn.
    const ai = generalQuestion ? null : await askCoreAi(event, body.message, contextId)
    // Tìm kiếm ngữ nghĩa chỉ ra thủ tục khi câu hỏi diễn đạt khác từ ngữ trong thủ tục (từ khóa không khớp).
    const semanticId = semanticProcedure(ai, new Set(catalog.map(p => p.id)))
    // Thủ tục do tìm kiếm ngữ nghĩa chỉ ra được ưu tiên hơn xếp hạng theo từ khóa (từ khóa bỏ dấu dễ khớp nhầm,
    // ví dụ "đại học" với "đất đai"); câu trả lời vẫn chỉ dựng từ dữ liệu thủ tục đã công bố.
    // Lõi từ chối câu hỏi tra cứu thông tin cá nhân hay hồ sơ cụ thể: trả lời từ chối, không tra cứu thêm.
    let result = ai?.mode === 'refused'
      ? {answer: ai.refusal || 'Trợ lý không tra cứu thông tin cá nhân hay hồ sơ cụ thể.', sources: [], suggestions: [], mode: 'INSUFFICIENT' as const, notice: ''}
      : buildGroundedAnswer(body.message, catalog, {
        contextId: contextId || semanticId, faq,
        selectedIds: semanticId ? [semanticId] : undefined,
        aiUsed: !!semanticId
      })
    // The index is an acceleration and retrieval layer only. Its citations
    // must agree with the canonical, freshly loaded catalog response.
    let indexReady = false
    if (result.mode !== 'INSUFFICIENT' && !isCatalogQuestion(body.message)) {
      const retrieval = ai?.chunks.length
        ? {ready: true, chunks: ai.chunks.map(({similarity, matched, ...chunk}) => chunk as IndexedChunk)}
        : await retrieveKnowledge(body.message, contextId)
      indexReady = retrieval.ready
      const allowedSources = new Set(result.sources.map(source => source.id))
      const fields = detectAnswerFields(body.message)
      const unsupportedFields = fields.includes('authority') || fields.includes('eligibility')
      const trustedChunks = retrieval.chunks.filter(chunk =>
        allowedSources.has(chunk.procedure_id ? `procedure:${chunk.procedure_id}` : chunk.id)
        && (chunk.field === 'faq' || chunk.field === 'title' || chunk.field === 'category'
          || fields.some(field => ({fee:'fee',duration:'duration',documents:'documents',instructions:'instructions',summary:'summary'} as Record<string,string>)[field] === chunk.field))
      )
      // Chỉ nhận trích dẫn của mô hình thuộc đoạn đã qua kiểm tra nguồn và trường; từng trích dẫn
      // phải nằm nguyên văn trong đoạn (composeExtractiveAnswer kiểm lại).
      const trustedById = new Map(trustedChunks.map(chunk => [chunk.id, chunk]))
      const selections = (ai?.selections || []).filter(selection => trustedById.has(selection.id))
      // Chỉ thay câu trả lời dựng từ dữ liệu khi trích dẫn có nội dung thật (không chỉ tên thủ tục, lĩnh vực)
      // và đúng loại thông tin được hỏi (hỏi thời hạn thì phải trích được thời hạn).
      const chunkFields = {fee:'fee',duration:'duration',documents:'documents',instructions:'instructions',summary:'summary'} as Record<string,string>
      const asked = fields.length < 5 ? fields.map(field => chunkFields[field]).filter(Boolean) : []
      const informative = selections.map(selection => trustedById.get(selection.id)!.field)
        .filter(field => field !== 'title' && field !== 'category')
      const useful = informative.length > 0 && (!asked.length || informative.some(field => asked.includes(field)))
      if (!unsupportedFields && trustedChunks.length && useful) {
        const generated = composeExtractiveAnswer(trustedChunks, selections)
        if (generated && generated.sources.every(source => allowedSources.has(source.id))) {
          result = {...generated, suggestions: result.suggestions}
        }
      }
    }
    let savedConversationId: string | null = null
    if (actor) {
      // Save the citizen's question and the VERIFIED answer as one transaction;
      // chat content is never inserted into the public RAG knowledge index.
      const saved = await citizenRpc<{conversationId:string}>(event, 'citizen_chat_save', {
        p_conversation_id: conversationId || null, p_question: body.message, p_answer: result.answer, p_mode: result.mode,
        p_sources: result.sources ?? [], p_suggestions: result.suggestions ?? [], p_notice: result.notice ?? null,
        p_revision: revision, p_unanswered_topic: result.mode === 'INSUFFICIENT' ? groupQuestionTopic(body.message) : null,
      })
      savedConversationId = saved.conversationId
    }
    // A published catalog row is not necessarily an independently verified legal source.
    // Associate citations with versioned provenance; do not promote staff claims to official facts.
    const citedIds=[...new Set(result.sources.map(source=>source.id.startsWith('procedure:')?source.id.slice('procedure:'.length):'').filter(Boolean))]
    const provenance=citedIds.length?await publicQuery<{procedure_id:string;source_url:string|null;source_title:string|null;
      source_reference:string|null;scope_note:string|null;effective_from:string|null;provenance_status:string}>(
      `SELECT DISTINCT ON (procedure_id) procedure_id,source_url,source_title,source_reference,scope_note,effective_from,provenance_status
       FROM citizen_procedure_versions WHERE procedure_id=ANY($1::text[]) ORDER BY procedure_id,version_no DESC`,[citedIds]):[]
    const sourceEvidence=citedIds.map(id=>{
      const p=provenance.find(item=>item.procedure_id===id)
      return {procedureId:id,sourceTitle:p?.source_title||null,sourceReference:p?.source_reference||null,
       sourceUrl:p?.source_url?.startsWith('https://')?p.source_url:null,scope:p?.scope_note||null,
       effectiveFrom:p?.effective_from||null,provenance:p?.provenance_status||'unverified_demo',independentlyVerified:false}
    })
    return {...result, revision, aiMode: ai?.mode || 'text', aiProcedure: semanticId || null, sourceEvidence, sourceVerification:'not_independently_verified', knowledgeSource: 'published_procedures', updatedOn: 'per_request', indexReady,
      conversationId: savedConversationId, saved: !!savedConversationId}
  } catch(error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[citizen-chat] Database knowledge unavailable', error instanceof Error ? error.message : 'unknown')
    throw createError({statusCode:503,statusMessage:'Không thể truy cập dữ liệu thủ tục lúc này. Trợ lý sẽ không đưa ra thông tin chưa được xác thực.'})
  }
})
