// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tìm kiếm toàn văn trên chỉ mục tri thức (chỉ thủ tục đã công bố và câu hỏi thường gặp) qua API công khai của lõi.
import { publicRpc } from './identity'
import { safeTsQuery, type IndexedChunk } from '../../shared/rag-evidence'
type DbChunk = Omit<IndexedChunk, 'score'> & {score: string | number}
export async function retrieveKnowledge(question:string, contextId = ''): Promise<{ready:boolean;chunks:IndexedChunk[]}> {
  const query = safeTsQuery(question)
  if (!query && !contextId) return {ready:true,chunks:[]}
  // PostgreSQL GIN full-text search; OR terms built from strictly normalized lexemes (api.public_knowledge_search).
  const rows = await publicRpc<DbChunk[]>('public_knowledge_search', {p_query: query, p_procedure_id: contextId})
  return {ready:true,chunks:rows.map(c=>({...c,score:Number(c.score)}))}
}
export async function readKnowledgeStatus(): Promise<{ready:boolean;chunks:number;procedures:number;faqs:number;lastIndexedAt:string|null}> {
  return publicRpc('public_knowledge_status')
}
