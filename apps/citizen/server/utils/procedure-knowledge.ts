// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto'
import { publicQuery } from './database'
import type { ProcedureEvidence, DocumentEvidence, FaqEvidence } from '../../shared/ai-knowledge'

type ProcedureRow = Omit<ProcedureEvidence, 'documents'> & { documents: unknown }

// Live database retrieval, not a periodically refreshed copy. Published procedures
// and their documents are authoritative *within this demo project only*.
export async function loadPublishedKnowledge(): Promise<{catalog: ProcedureEvidence[]; faq: FaqEvidence[]; revision: string}> {
  const rows = await publicQuery<ProcedureRow>(`
    SELECT p.id, p.title, p.category, p.summary, p.instructions, p.fee_note, p.sla_days,
      COALESCE(json_agg(json_build_object('document_code', d.document_code,
        'document_name', d.document_name, 'is_required', d.is_required)
        ORDER BY d.document_code) FILTER (WHERE d.document_code IS NOT NULL), '[]'::json) AS documents
    FROM procedures p LEFT JOIN procedure_documents d ON d.procedure_id = p.id
    WHERE p.published = true
    GROUP BY p.id ORDER BY p.title`, [])
  const catalog = rows.map(p => ({
    id: String(p.id), title: String(p.title), category: String(p.category),
    summary: String(p.summary || ''), instructions: String(p.instructions || ''),
    fee_note: String(p.fee_note || ''), sla_days: Number(p.sla_days),
    documents: (Array.isArray(p.documents) ? p.documents : []).map((d: DocumentEvidence) => ({
      document_code: String(d.document_code), document_name: String(d.document_name), is_required: Boolean(d.is_required)
    }))
  }))
  const faq = await publicQuery<FaqEvidence>('SELECT id, question, answer, keywords FROM citizen_faq ORDER BY id')
  const revision = createHash('sha256').update(JSON.stringify({catalog, faq})).digest('hex').slice(0, 16)
  return {catalog, faq, revision}
}
