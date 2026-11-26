// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Kho tri thức của trợ lý: thủ tục đã công bố, giấy tờ, câu hỏi thường gặp, đọc mới mỗi lần hỏi qua API công khai
// của lõi (api.public_knowledge). Published procedures are authoritative *within this demo project only*.
import { createHash } from 'node:crypto'
import { publicRpc } from './identity'
import type { ProcedureEvidence, DocumentEvidence, FaqEvidence } from '../../shared/ai-knowledge'
type ProcedureRow = Omit<ProcedureEvidence, 'documents'> & { documents: unknown }
export async function loadPublishedKnowledge(): Promise<{catalog: ProcedureEvidence[]; faq: FaqEvidence[]; revision: string}> {
  const data = await publicRpc<{catalog: ProcedureRow[]; faq: FaqEvidence[]}>('public_knowledge')
  const catalog = data.catalog.map(p => ({
    id: String(p.id), title: String(p.title), category: String(p.category),
    summary: String(p.summary || ''), instructions: String(p.instructions || ''),
    fee_note: String(p.fee_note || ''), sla_days: Number(p.sla_days),
    documents: (Array.isArray(p.documents) ? p.documents : []).map((d: DocumentEvidence) => ({
      document_code: String(d.document_code), document_name: String(d.document_name), is_required: Boolean(d.is_required)
    }))
  }))
  const faq = data.faq
  const revision = createHash('sha256').update(JSON.stringify({catalog, faq})).digest('hex').slice(0, 16)
  return {catalog, faq, revision}
}
