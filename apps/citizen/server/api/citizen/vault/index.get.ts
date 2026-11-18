// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../../utils/database'
export default defineEventHandler(event=>citizenTx(event,async client=>{
 const documents=(await client.query(`SELECT d.id,d.title,d.category,d.archived_at,d.created_at,d.updated_at,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'version_no',v.version_no,'original_name',v.original_name,
  'mime_type',v.mime_type,'size_bytes',v.size_bytes,'sha256',v.sha256,'expires_on',v.expires_on,'uploaded_at',v.uploaded_at)
  ORDER BY v.version_no DESC) FROM citizen_vault_versions v WHERE v.document_id=d.id),'[]'::jsonb) AS versions
  FROM citizen_vault_documents d ORDER BY d.archived_at NULLS FIRST,d.created_at DESC`)).rows
 const shares=(await client.query(`SELECT s.id,s.version_id,s.application_id,s.document_code,s.confirmed_at,
  d.title, v.version_no, a.procedure_id FROM citizen_vault_shares s
  JOIN citizen_vault_versions v ON v.id=s.version_id JOIN citizen_vault_documents d ON d.id=v.document_id
  JOIN applications a ON a.id=s.application_id ORDER BY s.confirmed_at DESC LIMIT 100`)).rows
 return {documents,shares}
}))
