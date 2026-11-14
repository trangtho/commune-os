-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API cho màn hình cán bộ xã (apps/commune). Chạy SAU 04-citizen-personalization.sql
-- vì dùng cột applications.receiving_tenant_id (xã tiếp nhận hồ sơ).
--
-- Quy tắc: hồ sơ thuộc về XÃ TIẾP NHẬN.
--   receiving_tenant_id = xã xử lý hồ sơ (mặc định = xã cư trú của người nộp)
--   tenant_id           = xã của tài khoản người dân (dùng cho RLS phía người dân)
-- Cán bộ xã A thấy mọi hồ sơ nộp VỀ xã A, kể cả người dân xã khác nộp liên thông.
-- Chạy lại nhiều lần không lỗi.

-- ===== 1. Cán bộ thấy hồ sơ theo xã tiếp nhận =====
DROP POLICY IF EXISTS staff_tenant_policy ON applications;
CREATE POLICY staff_tenant_policy ON applications FOR SELECT TO "commune-app"
  USING (coalesce(receiving_tenant_id, tenant_id) =
         (SELECT t.id FROM tenants t
           WHERE t.code = public.current_tenant_code() AND t.status = 'active'));

-- ===== 2. View hồ sơ đầy đủ cho màn hình cán bộ =====
-- tenant_code = xã tiếp nhận; home_tenant_code = xã của người nộp.
DROP VIEW IF EXISTS api.dossiers;
CREATE VIEW api.dossiers WITH (security_invoker = true) AS
SELECT a.id, rt.code AS tenant_code, ht.code AS home_tenant_code,
       a.procedure_id, p.title AS procedure_title, p.category,
       a.status, a.applicant_name,
       public.mask_phone(a.applicant_phone) AS applicant_phone,
       a.description, a.form_data, a.result_note,
       a.submitted_at, a.due_at, a.updated_at,
       (a.due_at IS NOT NULL AND a.due_at < CURRENT_DATE
         AND a.status NOT IN ('completed', 'rejected')) AS overdue
FROM applications a
JOIN tenants rt ON rt.id = coalesce(a.receiving_tenant_id, a.tenant_id)
JOIN tenants ht ON ht.id = a.tenant_id
JOIN procedures p ON p.id = a.procedure_id
WHERE a.status <> 'draft';

-- Số hồ sơ mỗi xã cũng tính theo xã tiếp nhận.
DROP VIEW IF EXISTS api.tenants;
CREATE VIEW api.tenants AS
SELECT t.id, t.code, t.name, t.status, t.created_at,
       (SELECT count(*) FROM applications a
         WHERE coalesce(a.receiving_tenant_id, a.tenant_id) = t.id
           AND a.status <> 'draft') AS dossier_count
FROM tenants t
WHERE public.is_sys_admin() OR t.code = public.current_tenant_code()
ORDER BY t.code;

-- ===== 3. Giấy tờ đã nộp và giấy tờ yêu cầu =====
-- document_owner_policy có sẵn lọc theo hồ sơ người gọi đọc được.
DROP VIEW IF EXISTS api.dossier_documents;
CREATE VIEW api.dossier_documents WITH (security_invoker = true) AS
SELECT d.id, d.application_id AS dossier_id, d.document_code, d.original_name,
       d.size_bytes, d.uploaded_at
FROM application_documents d;

DROP VIEW IF EXISTS api.procedure_documents;
CREATE VIEW api.procedure_documents WITH (security_invoker = true) AS
SELECT procedure_id, document_code, document_name, is_required FROM procedure_documents;

-- ===== 4. Quyền =====
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.dossiers, api.tenants, api.dossier_documents,
      api.procedure_documents TO "commune-app";
    GRANT SELECT ON application_documents, procedure_documents TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';