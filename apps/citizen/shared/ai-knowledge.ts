// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// This module contains only pure retrieval/answer synthesis logic (no database or LLM access).
// It deliberately does not use model-generated statements as administrative facts.
export type FaqEvidence = {id: number; question: string; answer: string; keywords: string}
export type DocumentEvidence = { document_code: string; document_name: string; is_required: boolean }
export type ProcedureEvidence = {
  id: string; title: string; category: string; summary: string; instructions: string;
  fee_note: string; sla_days: number; documents: DocumentEvidence[]
}
export type AnswerField = 'summary' | 'documents' | 'fee' | 'duration' | 'instructions' | 'authority' | 'eligibility'
export type SourceCitation = { id: string; title: string; url: string; excerpt: string }
export type ProcedureSuggestion = { id: string; title: string; url: string; category: string }
export type MatchedProcedure = { procedure: ProcedureEvidence; score: number }
export type GroundedAnswer = {
  answer: string; sources: SourceCitation[]; suggestions: ProcedureSuggestion[];
  mode: 'DATA' | 'RAG' | 'INSUFFICIENT'; notice: string;
}

export const ANSWER_FIELDS: AnswerField[] = ['summary', 'documents', 'fee', 'duration', 'instructions', 'authority', 'eligibility']
const stop = new Set('toi em minh ban anh chi cho ve voi sao ho mot hay cac co la cua va nhung tren trong he thong giup hoi thong tin thu tuc ho so the nao duoc khong bao nhieu can den lam de xem huong dan su dung hanh chinh dang ky nộp'.split(' '))
export function normalizeVietnamese(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, ' ').replace(/[-\s]+/g, ' ').trim()
}
function tokens(text: string): string[] {
  return [...new Set(normalizeVietnamese(text).split(' ').filter(w => w.length > 1 && !stop.has(w)))]
}
export function isOutOfScope(question: string): boolean {
  return /thoi tiet|du bao mua|ket qua bong da|chung khoan|gia bitcoin|giai tri|tu van suc khoe|benh gi|thuoc chua benh|cong thuc nau an/.test(normalizeVietnamese(question))
}
export function isCatalogQuestion(question: string): boolean {
  const normalized = normalizeVietnamese(question)
  return /thu tuc nao|danh sach thu tuc|co nhung thu tuc|co bao nhieu thu tuc|cac linh vuc|cac dich vu|danh muc thu tuc|liet ke thu tuc/.test(normalized)
}
export function detectAnswerFields(question: string): AnswerField[] {
  const q = normalizeVietnamese(question)
  const fields: AnswerField[] = []
  if (/giay to|tai lieu|thanh phan ho so|can chuan bi|ban chinh|ban sao|dinh kem|nop kem/.test(q)) fields.push('documents')
  if (/le phi|chi phi|mat phi|dong phi|bao nhieu tien|mien phi|muc phi/.test(q)) fields.push('fee')
  if (/bao lau|thoi han|thoi gian|may ngay|ngay lam viec|khi nao|giai quyet trong/.test(q)) fields.push('duration')
  if (/quy trinh|cac buoc|thu tuc the nao|thuc hien|cach lam|huong dan|nop nhu the nao/.test(q)) fields.push('instructions')
  if (/co quan|noi tiep nhan|ai tiep nhan|noi nop|nop o dau|xa nao|don vi tiep nhan|bo phan tiep nhan|uy ban/.test(q)) fields.push('authority')
  if (/dieu kien|du dieu kien|doi tuong|ai co the|duoc phep|yeu cau bat buoc/.test(q)) fields.push('eligibility')
  return fields.length ? fields : ['summary', 'instructions', 'documents', 'fee', 'duration']
}
export function rankProcedures(question: string, catalog: ProcedureEvidence[], contextId = ''): MatchedProcedure[] {
  const normalized = normalizeVietnamese(question)
  const queryTokens = tokens(question)
  return catalog.map(procedure => {
    const name = normalizeVietnamese(procedure.title)
    const titleWords = tokens(procedure.title)
    const category = normalizeVietnamese(procedure.category)
    const titleHits = titleWords.filter(word => queryTokens.includes(word))
    const nonTitle = normalizeVietnamese(`${procedure.summary} ${procedure.instructions} ${procedure.documents.map(d => d.document_name).join(' ')}`)
    let score = 0
    // An explicit selected published procedure has priority; it is still looked up from DB.
    if (contextId && procedure.id === contextId) score += 100
    if (normalized.includes(name) && name.length >= 5) score += 30
    if (normalized.includes(normalizeVietnamese(procedure.id)) && procedure.id.length >= 5) score += 22
    score += titleHits.length * 7
    if (titleHits.length >= 2) score += 9
    if (category && normalized.includes(category)) score += 5
    score += queryTokens.filter(t => nonTitle.split(' ').includes(t)).length * 0.3
    return {procedure, score}
  }).filter(hit => hit.score >= 6).sort((a, b) => b.score - a.score).slice(0, 5)
}
export function getSuggestions(matches: MatchedProcedure[]): ProcedureSuggestion[] {
  return matches.slice(0, 4).map(({procedure: p}) => ({id: p.id, title: p.title, url: `/thu-tuc/${encodeURIComponent(p.id)}`, category: p.category}))
}
const limitedNotice = 'Chỉ tham khảo dữ liệu thủ tục đang công bố trong CommuneOS (dữ liệu mẫu). Chưa thay thế hướng dẫn chính thức của cơ quan có thẩm quyền.'
const notFound = 'Tôi chưa tìm thấy thông tin đủ phù hợp trong danh mục thủ tục đang công bố của hệ thống. Bạn có thể nêu rõ tên thủ tục hoặc mở danh mục thủ tục để kiểm tra.'
const unavailable = 'Kho dữ liệu thủ tục hiện chưa ghi rõ thông tin này; tôi không thể tự suy đoán.'
function citation(procedure: ProcedureEvidence, excerpts: string[]): SourceCitation {
  return {
    id: `procedure:${procedure.id}`,
    title: procedure.title,
    url: `/thu-tuc/${encodeURIComponent(procedure.id)}`,
    excerpt: excerpts.slice(0, 2).join(' · ').slice(0, 320)
  }
}
function sourceSuggestion(p: ProcedureEvidence): ProcedureSuggestion {
  return {id: p.id, title: p.title, category: p.category, url: `/thu-tuc/${encodeURIComponent(p.id)}`}
}
function concise(text: string, max = 900): string { return String(text || '').trim().slice(0, max) }
function renderFacts(p: ProcedureEvidence, fields: AnswerField[]): {text: string; evidence: string[]} {
  const lines: string[] = []
  const evidence: string[] = []
  for (const field of fields) {
    if (field === 'summary') {
      if (p.summary.trim()) {lines.push(`• Nội dung: ${concise(p.summary)}`); evidence.push(`Mô tả: ${concise(p.summary, 140)}`)}
      else lines.push(`• Nội dung: ${unavailable}`)
    }
    if (field === 'documents') {
      if (p.documents.length) {
        lines.push('• Giấy tờ được hệ thống liệt kê:')
        for (const d of p.documents.slice(0, 30)) lines.push(`  – ${concise(d.document_name, 180)}${d.is_required ? ' (bắt buộc theo dữ liệu hệ thống)' : ' (không bắt buộc)'}`)
        evidence.push(`Giấy tờ: ${p.documents.map(d => d.document_name).join('; ').slice(0, 160)}`)
      } else lines.push(`• Giấy tờ: ${unavailable}`)
    }
    if (field === 'fee') {
      if (p.fee_note.trim()) { lines.push(`• Lệ phí (theo dữ liệu hệ thống): ${concise(p.fee_note, 220)}${/theo quy dinh|hien hanh/i.test(normalizeVietnamese(p.fee_note)) ? ' (chưa có mức tiền cụ thể)' : ''}`); evidence.push(`Lệ phí: ${concise(p.fee_note, 130)}`) }
      else lines.push(`• Lệ phí: ${unavailable}`)
    }
    if (field === 'duration') {
      if (Number.isSafeInteger(p.sla_days) && p.sla_days >= 0) { lines.push(`• Thời hạn theo dữ liệu hệ thống: ${p.sla_days} ngày (mẫu; chưa xác nhận là thời hạn pháp lý hiện hành).`); evidence.push(`Thời hạn: ${p.sla_days} ngày`) }
      else lines.push(`• Thời hạn: ${unavailable}`)
    }
    if (field === 'instructions') {
      if (p.instructions.trim()) { lines.push(`• Cách thực hiện/ghi chú: ${concise(p.instructions)}`); evidence.push(`Hướng dẫn: ${concise(p.instructions, 160)}`) }
      else lines.push(`• Các bước thực hiện: ${unavailable}`)
    }
    if (field === 'authority') lines.push(`• Cơ quan tiếp nhận: ${unavailable} Bạn có thể liên hệ bộ phận tiếp nhận để xác nhận nơi nộp.`)
    if (field === 'eligibility') lines.push(`• Điều kiện thực hiện: Dữ liệu hệ thống hiện chưa có trường điều kiện riêng được xác thực. ${p.instructions.trim() ? `Ghi chú hiện có: ${concise(p.instructions)}` : unavailable}`)
  }
  return {text: lines.join('\n'), evidence}
}
export function buildGroundedAnswer(question: string, catalog: ProcedureEvidence[], opts: {
  contextId?: string; selectedIds?: string[]; requestedFields?: AnswerField[]; aiUsed?: boolean; faq?: FaqEvidence[]
} = {}): GroundedAnswer {
  if (isOutOfScope(question)) return {answer: 'Câu hỏi này nằm ngoài phạm vi thủ tục hành chính đang công bố trong CommuneOS. Tôi không có nguồn dữ liệu phù hợp để tư vấn.', sources: [], suggestions: [], mode: 'INSUFFICIENT', notice: limitedNotice}
  const matches = rankProcedures(question, catalog, opts.contextId || '')
  const suggestions = getSuggestions(matches)
  if (isCatalogQuestion(question)) {
    if (!catalog.length) return {answer: notFound, sources: [], suggestions: [], mode: 'INSUFFICIENT', notice: limitedNotice}
    const items = catalog.slice(0, 20)
    return {
      answer: `Hệ thống hiện công bố ${catalog.length} thủ tục. Các thủ tục ${catalog.length > 20 ? 'đầu tiên ' : ''}gồm:\n${items.map(p => `• ${p.title} (${p.category})`).join('\n')}\nBạn có thể mở từng thủ tục để xem thông tin chi tiết.`,
      sources: items.map(p => citation(p, [p.summary])),
      suggestions: items.slice(0, 4).map(sourceSuggestion), mode: 'DATA', notice: limitedNotice
    }
  }
  if (!matches.length) {
    const questionNormalized = normalizeVietnamese(question)
    const categoryMatches = catalog.filter(p => p.category.trim() && questionNormalized.includes(normalizeVietnamese(p.category)))
    if (categoryMatches.length) {
      const items = categoryMatches.slice(0, 10)
      return {answer: `Trong lĩnh vực “${items[0]!.category}”, hệ thống hiện có ${categoryMatches.length} thủ tục phù hợp:\n${items.map(p => `• ${p.title}`).join('\n')}\nHãy chọn đúng thủ tục để hỏi chi tiết về giấy tờ, lệ phí hoặc thời hạn.`,
        sources: items.map(p => citation(p, [p.summary])), suggestions: items.slice(0, 4).map(sourceSuggestion), mode: 'DATA', notice: limitedNotice}
    }
    // Local FAQ is limited to using the portal, never a substitute for a specific
    // procedure's required documents, fees or legal conditions.
    if (!opts.contextId) {
      const relevant = (opts.faq || []).map(item => {
        const queryTerms = tokens(question)
        const faqTerms = tokens(`${item.question} ${item.keywords}`)
        return {item, score: queryTerms.filter(t => faqTerms.includes(t)).length}
      }).sort((a, b) => b.score - a.score)[0]
      if (relevant && relevant.score >= 2) {
        return {answer: `Theo hướng dẫn sử dụng CommuneOS:\n${concise(relevant.item.answer, 1500)}`,
          sources: [{id: `faq:${relevant.item.id}`, title: relevant.item.question, url: '/huong-dan', excerpt: concise(relevant.item.answer, 190)}],
          suggestions: [], mode: 'DATA', notice: limitedNotice}
      }
    }
    return {answer: notFound, sources: [], suggestions: [], mode: 'INSUFFICIENT', notice: limitedNotice}
  }
  const highest = matches[0]!
  // Do not guess which of two procedures was meant when confidence is comparable.
  if (!opts.contextId && !opts.selectedIds?.length && matches.length > 1 && highest.score < 28 && matches[1]!.score >= highest.score - 4) {
    return {answer: `Có nhiều thủ tục có thể liên quan đến câu hỏi của bạn. Vui lòng chọn một thủ tục ở mục “Thủ tục liên quan” hoặc nêu tên chính xác.`, sources: [], suggestions, mode: 'INSUFFICIENT', notice: limitedNotice}
  }
  const allowedIds = new Set(matches.map(m => m.procedure.id))
  const selection = (opts.selectedIds || []).find(id => allowedIds.has(id))
  const p = selection ? catalog.find(p => p.id === selection)! : highest.procedure
  const fields = opts.requestedFields?.filter(f => ANSWER_FIELDS.includes(f)) || detectAnswerFields(question)
  const {text, evidence} = renderFacts(p, fields.length ? fields : detectAnswerFields(question))
  return {
    answer: `Theo dữ liệu thủ tục “${p.title}” đang công bố trên CommuneOS:\n${text}\n\nXem trang thủ tục để đối chiếu thông tin và giấy tờ trước khi nộp.`,
    sources: [citation(p, evidence.length ? evidence : [p.title])],
    suggestions: [sourceSuggestion(p), ...suggestions.filter(x => x.id !== p.id)].slice(0, 4),
    mode: opts.aiUsed ? 'RAG' : 'DATA', notice: limitedNotice
  }
}
