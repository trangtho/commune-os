// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Pure functions so the security boundary can be tested without Nuxt/database.
import { normalizeVietnamese, type GroundedAnswer, type SourceCitation, type ProcedureSuggestion } from './ai-knowledge.ts'

export type IndexedChunk = {
  id: string; source_type: 'procedure'|'faq'; procedure_id: string|null;
  field: string; source_title: string; content: string; score: number
}
export type ModelSelection = {id:string; quote:string}

const stopwords = new Set('toi em minh ban anh chi cho ve voi sao mot hay cac co la cua va nhung tren trong he thong giup hoi thong tin thu tuc ho so the nao duoc khong bao nhieu can den lam de xem huong dan su dung dang ky nop ke tai lieu giay to le phi thoi gian phi buoc cap ket qua xin'.split(' '))
// Only normalized alphanumeric lexemes can reach to_tsquery, never user syntax.
export function safeTsQuery(message: string): string {
  const parts = normalizeVietnamese(message).split(' ')
    .filter(t => /^[a-z0-9]{3,32}$/.test(t) && !stopwords.has(t) && !/^\d+$/.test(t))
  return [...new Set(parts)].slice(0, 12).join(' | ')
}
const labels: Record<string,string> = {
  title:'Thủ tục', category:'Lĩnh vực', summary:'Nội dung', instructions:'Cách thực hiện',
  fee:'Lệ phí', duration:'Thời hạn', documents:'Giấy tờ', faq:'Hướng dẫn cổng công dân'
}
function evidenceLink(chunk: IndexedChunk): string {
  return chunk.procedure_id ? `/thu-tuc/${encodeURIComponent(chunk.procedure_id)}` : '/huong-dan'
}
export function collectVerbatimEvidence(chunks: IndexedChunk[], selections: ModelSelection[]): {lines:string[];sources:SourceCitation[];suggestions:ProcedureSuggestion[]} | null {
  if (!Array.isArray(selections) || selections.length === 0 || selections.length > 6) return null
  const allowed = new Map(chunks.map(c => [c.id,c]))
  const seen = new Set<string>()
  const lines: string[] = []
  const sources: SourceCitation[] = []
  const suggestions: ProcedureSuggestion[] = []
  for (const selected of selections) {
    if (!selected || typeof selected.id !== 'string' || typeof selected.quote !== 'string') return null
    const chunk = allowed.get(selected.id)
    const quote = selected.quote.trim()
    // Model cannot add, amend or paraphrase any fact, URL or source title.
    if (!chunk || quote.length < 7 || quote.length > 450 || !chunk.content.includes(quote)) return null
    if (seen.has(selected.id)) continue
    seen.add(selected.id)
    lines.push(`• ${labels[chunk.field] || 'Nguồn dữ liệu'}: ${quote}`)
    const sourceId = chunk.procedure_id ? `procedure:${chunk.procedure_id}` : `faq:${chunk.id.slice(4)}`
    const existing = sources.find(s => s.id === sourceId)
    if (!existing) {
      sources.push({id:sourceId,title:chunk.source_title,url:evidenceLink(chunk),excerpt:quote})
      if (chunk.procedure_id) suggestions.push({id:chunk.procedure_id,title:chunk.source_title,url:evidenceLink(chunk),category:''})
    } else if (!existing.excerpt.includes(quote)) {
      existing.excerpt = `${existing.excerpt} · ${quote}`.slice(0,350)
    }
  }
  if (!lines.length || !sources.length) return null
  return {lines,sources,suggestions}
}
export function composeExtractiveAnswer(chunks: IndexedChunk[], selections: ModelSelection[]): GroundedAnswer | null {
  const evidence = collectVerbatimEvidence(chunks,selections)
  if (!evidence) return null
  return {
    answer: `Tôi tìm thấy các nội dung sau trong dữ liệu CommuneOS:\n${evidence.lines.join('\n')}\n\nBạn có thể mở nguồn trích dẫn để kiểm tra trước khi thực hiện thủ tục.`,
    sources: evidence.sources,
    suggestions: evidence.suggestions.slice(0,4),
    mode:'RAG',
    notice:'Câu trả lời chỉ trích nội dung có trong cơ sở dữ liệu CommuneOS (đang là dữ liệu minh họa), chưa thay thế hướng dẫn chính thức.'
  }
}
