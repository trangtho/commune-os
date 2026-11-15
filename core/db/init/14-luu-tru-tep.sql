-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Lưu trữ dữ liệu phi cấu trúc (giấy tờ của hồ sơ).
--   * Nội dung tệp nằm ở kho đối tượng chuẩn S3 (SeaweedFS), do dịch vụ tệp của lõi quản lý.
--   * PostgreSQL chỉ giữ thông tin mô tả: tên, loại, kích thước, mã băm SHA-256, khóa đối tượng.
--   * Mỗi giấy tờ mới sinh một sự kiện hồ sơ có ghi mã băm, nên mã băm đi vào sổ ghi nhận (10-ledger.sql).
-- Chạy lại nhiều lần không sao. Cần chạy sau 11-workflow.sql (dùng is_workflow_call).

-- ===== 1. Mã băm của từng tệp =====
ALTER TABLE application_documents ADD COLUMN IF NOT EXISTS sha256 text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'application_documents_sha256_check') THEN
    ALTER TABLE application_documents ADD CONSTRAINT application_documents_sha256_check
      CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$');
  END IF;
END $$;

-- ===== 2. Giấy tờ mới → sự kiện hồ sơ → sổ ghi nhận =====
CREATE OR REPLACE FUNCTION public.document_to_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO application_events (application_id, event_type, note, actor_name)
  VALUES (NEW.application_id, 'document_upload',
          format('Giấy tờ %s: %s (SHA-256 %s)', NEW.document_code, NEW.original_name,
                 coalesce(NEW.sha256, 'chưa có')),
          coalesce(nullif(current_setting('app.document_actor', true), ''), 'Người nộp hồ sơ'));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS document_to_event ON application_documents;
CREATE TRIGGER document_to_event AFTER INSERT ON application_documents
  FOR EACH ROW EXECUTE FUNCTION public.document_to_event();

-- ===== 3. Cán bộ xem giấy tờ của hồ sơ thuộc xã mình =====
-- Hồ sơ đã được lọc theo xã bằng staff_tenant_policy (08), nên chỉ cần "hồ sơ nhìn thấy được".
DROP POLICY IF EXISTS staff_document_policy ON application_documents;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    CREATE POLICY staff_document_policy ON application_documents FOR SELECT TO "commune-app"
      USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_documents.application_id));
  END IF;
END $$;

DROP VIEW IF EXISTS api.dossier_documents;
CREATE VIEW api.dossier_documents WITH (security_invoker = true) AS
SELECT d.id, d.application_id AS dossier_id, d.document_code, d.original_name,
       d.mime_type, d.size_bytes, d.sha256, d.uploaded_at
FROM application_documents d;

-- ===== 4. Hai hàm chỉ dịch vụ tệp gọi được (kèm khóa nội bộ X-Workflow-Token) =====

-- Trả khóa đối tượng của một giấy tờ, nếu người gọi được xem giấy tờ đó (RLS áp dụng).
CREATE OR REPLACE FUNCTION api.document_object(document_id uuid)
RETURNS TABLE (storage_key text, original_name text, mime_type text, sha256 text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ tệp của lõi được gọi hàm này' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT d.storage_key, d.original_name, d.mime_type, d.sha256
    FROM application_documents d WHERE d.id = document_id;
END $$;

-- Ghi thông tin một giấy tờ cán bộ vừa tải lên (nội dung đã nằm trong kho đối tượng).
CREATE OR REPLACE FUNCTION api.register_document(
  dossier_id text, document_code text, original_name text, mime_type text,
  size_bytes integer, sha256 text, storage_key text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claims   jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_tenant tenants%ROWTYPE;
  v_app    applications%ROWTYPE;
  v_row    application_documents%ROWTYPE;
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Tải giấy tờ phải đi qua dịch vụ tệp của lõi (/files)' USING ERRCODE = '42501';
  END IF;
  IF NOT (coalesce(claims -> 'realm_access' -> 'roles', '[]'::jsonb)
          ?| array['receptionist', 'officer', 'leader']) THEN
    RAISE EXCEPTION 'Chỉ cán bộ xã được tải giấy tờ' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tenant FROM tenants t WHERE t.code = claims ->> 'tenant_id';
  IF v_tenant.id IS NULL OR v_tenant.status <> 'active' THEN
    RAISE EXCEPTION 'Xã của bạn đang bị khóa hoặc không tồn tại' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_app FROM applications a
   WHERE a.id = register_document.dossier_id
     AND coalesce(a.receiving_tenant_id, a.tenant_id) = v_tenant.id;
  IF v_app.id IS NULL THEN
    RAISE EXCEPTION 'Hồ sơ không tồn tại' USING ERRCODE = 'PT404';
  END IF;

  IF register_document.mime_type NOT IN ('application/pdf', 'image/png', 'image/jpeg')
     OR register_document.size_bytes NOT BETWEEN 1 AND 5242880
     OR register_document.sha256 !~ '^[0-9a-f]{64}$'
     OR register_document.storage_key !~ '^[0-9a-f-]{36}\.(pdf|png|jpg)$' THEN
    RAISE EXCEPTION 'Thông tin tệp không hợp lệ' USING ERRCODE = '22023';
  END IF;
  -- Loại giấy tờ: theo danh mục của thủ tục, hoặc "ket-qua" (kết quả giải quyết), hoặc "other".
  IF register_document.document_code NOT IN ('ket-qua', 'other') AND NOT EXISTS (
       SELECT 1 FROM procedure_documents pd
        WHERE pd.procedure_id = v_app.procedure_id AND pd.document_code = register_document.document_code) THEN
    RAISE EXCEPTION 'Loại giấy tờ không thuộc thủ tục này' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.document_actor',
    coalesce(claims ->> 'name', claims ->> 'preferred_username', 'Cán bộ'), true);
  INSERT INTO application_documents (application_id, document_code, original_name,
                                     storage_key, mime_type, size_bytes, sha256)
  VALUES (v_app.id, register_document.document_code,
          left(regexp_replace(register_document.original_name, '[\\/\r\n[:cntrl:]]', '', 'g'), 180),
          register_document.storage_key, register_document.mime_type,
          register_document.size_bytes, register_document.sha256)
  RETURNING * INTO v_row;

  RETURN json_build_object('id', v_row.id, 'dossier_id', v_row.application_id,
    'document_code', v_row.document_code, 'original_name', v_row.original_name,
    'size_bytes', v_row.size_bytes, 'sha256', v_row.sha256, 'uploaded_at', v_row.uploaded_at);
END $$;

REVOKE ALL ON FUNCTION api.document_object(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION api.register_document(text, text, text, text, integer, text, text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.dossier_documents TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.document_object(uuid) TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.register_document(text, text, text, text, integer, text, text) TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
