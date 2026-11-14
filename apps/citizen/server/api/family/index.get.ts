// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
// Family view is strictly a view of this citizen's own submissions.
// Even a verified representative has NO access to another citizen's private cases.
export default defineEventHandler(event => citizenTx(event, async client => {
  const members = (await client.query(`SELECT r.id,r.represented_name,r.relationship,r.procedure_id,
    p.title AS procedure_title,r.valid_until,r.verified_at,r.status
    FROM citizen_representations r JOIN procedures p ON p.id=r.procedure_id
    WHERE r.status='verified' AND r.valid_until >= CURRENT_DATE
    ORDER BY r.represented_name,r.procedure_id LIMIT 100`)).rows
  const cases = (await client.query(`SELECT a.id,a.representation_id,a.procedure_id,p.title AS procedure_title,
    a.applicant_name,a.status,a.submitted_at,a.updated_at,a.due_at,
    (SELECT count(*)::int FROM application_documents d WHERE d.application_id=a.id) AS document_count
    FROM applications a JOIN procedures p ON p.id=a.procedure_id
    WHERE a.representation_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM citizen_representations r WHERE r.id=a.representation_id
      AND r.status='verified' AND r.valid_until>=CURRENT_DATE AND r.procedure_id=a.procedure_id)
    ORDER BY a.updated_at DESC LIMIT 200`)).rows
  return { members, cases, notice:'Chỉ hiển thị hồ sơ do chính tài khoản này nộp theo quyền đại diện đã xác minh. Không truy cập hồ sơ riêng của người thân.' }
}))
