// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Trợ lý AI cho cán bộ: gọi cổng AI của lõi (/ai/ask) bằng token của cán bộ. Lõi tự giới hạn phạm vi theo
// token: chỉ thủ tục xã của cán bộ đang mở và hướng dẫn nghiệp vụ; không truy cập hồ sơ, giấy tờ hay
// dữ liệu cá nhân của công dân. Câu trả lời chỉ gồm câu trích nguyên văn từ nguồn, kèm đường dẫn nguồn.
import { z } from 'zod'
import { requireStaff } from '../utils/session'
import { validate } from '../utils/validation'

type Chunk = { id: string; source_type: string; procedure_id: string | null; field: string; source_title: string; content: string; matched: string }
type AiResult = { mode: string; refusal?: string; chunks: Chunk[]; selections: { id: string; quote: string }[]; masked: boolean }
const schema = z.object({ message: z.string().trim().min(5).max(500) })
const labels: Record<string, string> = {
  title: 'Thủ tục', category: 'Lĩnh vực', summary: 'Nội dung', instructions: 'Cách thực hiện', fee: 'Lệ phí',
  duration: 'Thời hạn', documents: 'Giấy tờ', faq: 'Hướng dẫn công dân', staff_guide: 'Hướng dẫn nghiệp vụ',
}
const NOTICE = 'Trợ lý chỉ dùng thủ tục xã đang mở và hướng dẫn nghiệp vụ; không truy cập hồ sơ hay dữ liệu cá nhân của công dân. Đối chiếu nguồn trước khi xử lý.'
const sourceUrl = (c: Chunk) => (c.procedure_id ? `/thu-tuc/${encodeURIComponent(c.procedure_id)}` : null)
const short = (text: string, n = 260) => (text.length > n ? `${text.slice(0, n).trimEnd()}…` : text)
// Mục hỏi đáp, hướng dẫn: nội dung gồm câu hỏi rồi câu trả lời; chỉ hiện phần trả lời.
const answerPart = (c: Chunk) => c.source_type === 'staff_guide' ? c.content.split('\n').slice(1).join(' ')
  : c.source_type === 'faq' ? c.content.slice(c.content.indexOf(': ') + 2) : c.content

export default defineEventHandler(async (event) => {
  const actor = requireStaff(event)
  const { message } = validate(schema, await readBody(event))
  const { gatewayUrl } = useRuntimeConfig(event)
  let ai: AiResult
  try {
    ai = await $fetch<AiResult>(`${gatewayUrl}/ai/ask`, {
      method: 'POST', body: { question: message }, headers: { Authorization: `Bearer ${actor.token}` }, timeout: 90_000,
    })
  } catch (e: any) {
    if (e?.response?.status === 429) throw createError({ statusCode: 429, statusMessage: 'Bạn đang hỏi quá nhiều, vui lòng thử lại sau một phút.' })
    throw createError({ statusCode: 503, statusMessage: 'Trợ lý AI tạm thời chưa sẵn sàng.' })
  }
  if (ai.mode === 'refused') return { answer: ai.refusal, sources: [], mode: 'REFUSED', notice: NOTICE }
  const byId = new Map(ai.chunks.map((c) => [c.id, c]))
  // Ưu tiên câu mô hình chọn (đã kiểm nguyên văn ở lõi); không có thì đưa các đoạn tìm thấy khớp nhất.
  // Trích dẫn chỉ là tên thủ tục hay lĩnh vực không trả lời được câu hỏi, nên bỏ.
  const informative = (c: Chunk) => c.field !== 'title' && c.field !== 'category'
  const picked = ai.selections.map((s) => ({ chunk: byId.get(s.id)!, text: s.quote })).filter((x) => x.chunk && informative(x.chunk))
  const used = picked.length ? picked : ai.chunks.filter(informative).slice(0, 3).map((c) => ({ chunk: c, text: short(answerPart(c)) }))
  if (!used.length) {
    return { answer: 'Chưa tìm thấy nội dung phù hợp trong thủ tục xã đang mở và hướng dẫn nghiệp vụ. Hãy nêu rõ tên thủ tục hoặc thao tác cần làm.', sources: [], mode: 'INSUFFICIENT', notice: NOTICE }
  }
  const sources = [...new Map(used.map(({ chunk }) => [chunk.procedure_id || chunk.id, { title: chunk.source_title, url: sourceUrl(chunk) }])).values()]
  return {
    answer: (picked.length ? 'Theo dữ liệu CommuneOS:\n' : 'Các nội dung liên quan nhất:\n')
      + used.map(({ chunk, text }) => `• ${labels[chunk.field] || chunk.source_title}${chunk.source_type === 'procedure' ? ` (${chunk.source_title})` : ''}: ${text}`).join('\n'),
    sources, mode: picked.length ? 'MODEL' : 'SEARCH', notice: NOTICE, masked: ai.masked,
  }
})
