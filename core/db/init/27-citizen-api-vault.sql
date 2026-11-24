-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API của lõi cho kho giấy tờ cá nhân và tự điền biểu mẫu của Kênh người dân, gọi qua cổng APISIX
-- (POST /rest/rpc/<tên hàm>) bằng token Keycloak của công dân (client citizen-app).
-- Cách làm giống core/db/init/21-citizen-api-core-flow.sql: hàm chạy bằng quyền người gọi (SECURITY INVOKER),
-- rest_pre_request() đặt app.citizen_id, app.tenant_id từ token nên RLS sẵn có quyết định công dân thấy gì.
-- Mỗi hàm là trọn một giao dịch của API cũ trong ứng dụng. Tệp vẫn do Kênh người dân kiểm tra định dạng và lưu
-- vào kho đối tượng của lõi trước khi gọi; hàm chỉ ghi siêu dữ liệu.
-- Lỗi nghiệp vụ dùng mã PTxyz (PostgREST trả HTTP xyz kèm lời nhắn). Chạy lại nhiều lần được.

-- ===== 1. Quyền của citizen-app: chép quyền communeos_app (vai trò Kênh người dân dùng khi nối trực tiếp) =====
-- Bảng, cột, chuỗi số và hàm của schema public. Không chép quyền gọi hàm dành cho cán bộ (đã thành API của lõi
-- cho cán bộ ở 26-citizen-staff-api.sql). citizen-app chỉ vào được cơ sở dữ liệu qua PostgREST (schema api), nên
-- các quyền này chỉ dùng được bên trong hàm api.*; RLS vẫn áp dụng.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT table_name, string_agg(DISTINCT privilege_type, ', ') AS privs
           FROM information_schema.role_table_grants
           WHERE grantee = 'communeos_app' AND table_schema = 'public' GROUP BY table_name LOOP
    EXECUTE format('GRANT %s ON public.%I TO "citizen-app"', r.privs, r.table_name);
  END LOOP;
  FOR r IN SELECT table_name, privilege_type, string_agg(quote_ident(column_name), ', ') AS cols
           FROM information_schema.column_privileges
           WHERE grantee = 'communeos_app' AND table_schema = 'public'
           GROUP BY table_name, privilege_type LOOP
    EXECUTE format('GRANT %s (%s) ON public.%I TO "citizen-app"', r.privilege_type, r.cols, r.table_name);
  END LOOP;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'S'
             AND CASE WHEN c.relkind = 'S' THEN has_sequence_privilege('communeos_app', c.oid, 'USAGE') ELSE false END LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO "citizen-app"', r.relname);
  END LOOP;
  FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prokind = 'f'
             AND p.proname NOT LIKE 'citizen\_staff\_%' AND p.proname NOT IN ('citizen_publish_procedure_version', 'citizen_dispatch_reminders')
             AND EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 'communeos_app'::regrole AND a.privilege_type = 'EXECUTE') LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', r.fn);
  END LOOP;
END $$;

-- ===== 2. Hàm dùng chung =====
-- Dùng lại hàm phụ của 21-citizen-api-core-flow.sql: public.citizen_actor() (công dân từ token, chưa có thì 401),
-- public.citizen_record_access() (nhật ký sử dụng dữ liệu cá nhân), public.citizen_fail().

-- Công dân còn đồng ý cho một mục đích không (quyết định mới nhất là cho phép và còn hạn).
CREATE OR REPLACE FUNCTION public.citizen_active_consent(p_purpose text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce((SELECT decision = 'granted' AND valid_until > now() FROM citizen_consent_events
                   WHERE purpose_id = p_purpose ORDER BY id DESC LIMIT 1), false)
$$;

-- Phiên bản giấy tờ đang bị hạn chế theo quyết định lưu trữ.
CREATE OR REPLACE FUNCTION public.citizen_vault_restricted(p_version_id uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM citizen_retention_reviews
                 WHERE resource_kind = 'vault_version' AND resource_reference = p_version_id::text
                   AND state IN ('restricted', 'archived'))
$$;

-- Ngày hôm nay theo giờ Việt Nam (hạn giấy tờ tính theo ngày Việt Nam, như shared/citizen-vault.ts).
CREATE OR REPLACE FUNCTION public.today_vietnam() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date $$;

-- ===== 3. Kho giấy tờ =====
CREATE OR REPLACE FUNCTION api.citizen_vault() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  PERFORM public.citizen_actor();
  RETURN json_build_object(
    'documents', coalesce((SELECT json_agg(x ORDER BY x.archived_at NULLS FIRST, x.created_at DESC) FROM (
      SELECT d.id, d.title, d.category, d.archived_at, d.created_at, d.updated_at,
        coalesce((SELECT jsonb_agg(jsonb_build_object('id', v.id, 'version_no', v.version_no, 'original_name', v.original_name,
          'mime_type', v.mime_type, 'size_bytes', v.size_bytes, 'sha256', v.sha256, 'expires_on', v.expires_on,
          'uploaded_at', v.uploaded_at) ORDER BY v.version_no DESC)
          FROM citizen_vault_versions v WHERE v.document_id = d.id), '[]'::jsonb) AS versions
      FROM citizen_vault_documents d) x), '[]'::json),
    'shares', coalesce((SELECT json_agg(s ORDER BY s.confirmed_at DESC) FROM (
      SELECT s.id, s.version_id, s.application_id, s.document_code, s.confirmed_at, d.title, v.version_no, a.procedure_id
      FROM citizen_vault_shares s
      JOIN citizen_vault_versions v ON v.id = s.version_id
      JOIN citizen_vault_documents d ON d.id = v.document_id
      JOIN applications a ON a.id = s.application_id
      ORDER BY s.confirmed_at DESC LIMIT 100) s), '[]'::json));
END $$;

-- Thêm giấy tờ mới (p_document_id rỗng, cần p_title, p_category) hoặc phiên bản mới cho giấy tờ đã có.
CREATE OR REPLACE FUNCTION api.citizen_vault_add(p_document_id uuid, p_title text, p_category text, p_original_name text,
  p_storage_key text, p_mime_type text, p_size_bytes integer, p_sha256 text, p_expires_on date DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_citizen uuid;
  v_tenant uuid;
  v_doc uuid := p_document_id;
  v_archived timestamptz;
  v_last int;
  v_row record;
BEGIN
  SELECT a.citizen_id, a.tenant_id INTO v_citizen, v_tenant FROM public.citizen_actor() a;
  IF v_doc IS NOT NULL THEN
    SELECT id, archived_at INTO v_doc, v_archived FROM citizen_vault_documents WHERE id = p_document_id FOR UPDATE;
    IF v_doc IS NULL OR v_archived IS NOT NULL THEN
      RAISE EXCEPTION 'Giấy tờ đã lưu trữ hoặc không tồn tại' USING ERRCODE = 'PT404';
    END IF;
  ELSE
    IF (SELECT count(*) FROM citizen_vault_documents) >= 100 THEN
      RAISE EXCEPTION 'Kho tối đa 100 nhóm giấy tờ' USING ERRCODE = 'PT422';
    END IF;
    INSERT INTO citizen_vault_documents(citizen_id, tenant_id, title, category)
    VALUES (v_citizen, v_tenant, public.check_text(p_title, 'Tên giấy tờ', 2, 120), p_category)
    RETURNING id INTO v_doc;
  END IF;
  SELECT coalesce(max(version_no), 0) INTO v_last FROM citizen_vault_versions WHERE document_id = v_doc;
  IF v_last >= 100 THEN RAISE EXCEPTION 'Giấy tờ tối đa 100 phiên bản' USING ERRCODE = 'PT422'; END IF;
  INSERT INTO citizen_vault_versions(document_id, version_no, original_name, storage_key, mime_type, size_bytes, sha256, expires_on)
  VALUES (v_doc, v_last + 1, p_original_name, p_storage_key, p_mime_type, p_size_bytes, p_sha256, p_expires_on)
  RETURNING id, version_no INTO v_row;
  UPDATE citizen_vault_documents SET updated_at = now() WHERE id = v_doc;
  RETURN json_build_object('documentId', v_doc, 'id', v_row.id, 'version_no', v_row.version_no);
END $$;

-- Sửa tên, loại hoặc lưu trữ / bỏ lưu trữ một giấy tờ (tham số để NULL là giữ nguyên).
CREATE OR REPLACE FUNCTION api.citizen_vault_update(p_document_id uuid, p_title text DEFAULT NULL, p_category text DEFAULT NULL,
  p_archived boolean DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_row record;
BEGIN
  PERFORM public.citizen_actor();
  IF p_title IS NOT NULL THEN PERFORM public.check_text(p_title, 'Tên giấy tờ', 2, 120); END IF;
  UPDATE citizen_vault_documents SET title = coalesce(btrim(p_title), title), category = coalesce(p_category, category),
    archived_at = CASE WHEN p_archived IS NULL THEN archived_at WHEN p_archived THEN now() ELSE NULL END, updated_at = now()
  WHERE id = p_document_id RETURNING id, title, category, archived_at INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy giấy tờ có quyền sửa' USING ERRCODE = 'PT404'; END IF;
  RETURN row_to_json(v_row);
END $$;

-- Đặt hoặc bỏ (NULL) ngày hết hạn của một phiên bản, chỉ khi giấy tờ chưa lưu trữ.
CREATE OR REPLACE FUNCTION api.citizen_vault_version_update(p_version_id uuid, p_expires_on date) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_row record;
BEGIN
  PERFORM public.citizen_actor();
  UPDATE citizen_vault_versions v SET expires_on = p_expires_on
  WHERE v.id = p_version_id
    AND EXISTS (SELECT 1 FROM citizen_vault_documents d WHERE d.id = v.document_id AND d.archived_at IS NULL)
  RETURNING v.id, v.expires_on INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy phiên bản có quyền cập nhật' USING ERRCODE = 'PT404'; END IF;
  RETURN row_to_json(v_row);
END $$;

-- Thông tin để Kênh người dân tải tệp của một phiên bản; ghi nhật ký sử dụng dữ liệu cá nhân.
-- Khóa tệp (storage_key) chỉ trả cho máy chủ Kênh người dân, không trả cho trình duyệt.
CREATE OR REPLACE FUNCTION api.citizen_vault_file(p_version_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_row record;
BEGIN
  PERFORM public.citizen_actor();
  SELECT v.storage_key, v.original_name, v.mime_type INTO v_row FROM citizen_vault_versions v WHERE v.id = p_version_id;
  IF v_row.storage_key IS NULL THEN RAISE EXCEPTION 'Không tìm thấy tệp trong kho của bạn' USING ERRCODE = 'PT404'; END IF;
  IF public.citizen_vault_restricted(p_version_id) THEN
    RAISE EXCEPTION 'Giấy tờ đang hạn chế truy cập theo quyết định lưu trữ, vui lòng gửi yêu cầu xem xét' USING ERRCODE = 'PT403';
  END IF;
  PERFORM public.citizen_record_access('download_vault_file', 'Công dân xem giấy tờ của mình', 'vault_version', p_version_id::text);
  RETURN row_to_json(v_row);
END $$;

-- ===== 4. Dùng giấy tờ trong kho cho hồ sơ =====
-- Bước 1: kiểm tra quyền tái sử dụng và giấy tờ nguồn, trả thông tin để Kênh người dân sao tệp.
CREATE OR REPLACE FUNCTION api.citizen_vault_source(p_version_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_row record;
BEGIN
  PERFORM public.citizen_actor();
  IF NOT public.citizen_active_consent('vault_case_reuse') THEN
    RAISE EXCEPTION 'Vui lòng cấp quyền tái sử dụng giấy tờ tại Trung tâm quyền chia sẻ trước khi đính kèm' USING ERRCODE = 'PT403';
  END IF;
  SELECT v.storage_key, v.original_name, v.mime_type, v.sha256, v.expires_on, d.archived_at INTO v_row
  FROM citizen_vault_versions v JOIN citizen_vault_documents d ON d.id = v.document_id
  WHERE v.id = p_version_id FOR SHARE OF v, d;
  IF v_row.storage_key IS NULL THEN RAISE EXCEPTION 'Không tìm thấy phiên bản giấy tờ thuộc tài khoản' USING ERRCODE = 'PT404'; END IF;
  IF public.citizen_vault_restricted(p_version_id) THEN
    RAISE EXCEPTION 'Tài liệu đang được hạn chế theo quyết định lưu trữ' USING ERRCODE = 'PT403';
  END IF;
  IF v_row.archived_at IS NOT NULL OR (v_row.expires_on IS NOT NULL AND v_row.expires_on < public.today_vietnam()) THEN
    RAISE EXCEPTION 'Giấy tờ đã lưu trữ hoặc hết hạn' USING ERRCODE = 'PT422';
  END IF;
  RETURN json_build_object('storage_key', v_row.storage_key, 'original_name', v_row.original_name,
    'mime_type', v_row.mime_type, 'sha256', v_row.sha256);
END $$;

-- Bước 2: gắn bản sao tệp (đã lưu vào kho, mã băm đã kiểm) vào hồ sơ đang soạn hoặc đang bổ sung.
-- Kiểm tra lại mọi điều kiện trong cùng giao dịch với lệnh ghi.
CREATE OR REPLACE FUNCTION api.citizen_vault_attach(p_application_id text, p_version_id uuid, p_document_code text,
  p_original_name text, p_storage_key text, p_mime_type text, p_size_bytes integer, p_sha256 text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_citizen uuid;
  v_tenant uuid;
  v_app record;
  v_doc record;
  v_row record;
BEGIN
  SELECT a.citizen_id, a.tenant_id INTO v_citizen, v_tenant FROM public.citizen_actor() a;
  IF length(coalesce(p_document_code, '')) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Loại giấy tờ không hợp lệ' USING ERRCODE = 'PT400';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_citizen::text || ':vault_case_reuse'));
  IF NOT public.citizen_active_consent('vault_case_reuse') THEN
    RAISE EXCEPTION 'Quyền sử dụng lại giấy tờ đã hết hạn hoặc bị rút' USING ERRCODE = 'PT403';
  END IF;
  SELECT id, status, procedure_id INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_app.id IS NULL OR v_app.status NOT IN ('draft', 'supplement') THEN
    RAISE EXCEPTION 'Hồ sơ không cho phép bổ sung giấy tờ' USING ERRCODE = 'PT403';
  END IF;
  SELECT v.id, v.expires_on, d.archived_at INTO v_doc
  FROM citizen_vault_versions v JOIN citizen_vault_documents d ON d.id = v.document_id
  WHERE v.id = p_version_id FOR SHARE OF v, d;
  IF v_doc.id IS NULL OR v_doc.archived_at IS NOT NULL OR (v_doc.expires_on IS NOT NULL AND v_doc.expires_on < public.today_vietnam()) THEN
    RAISE EXCEPTION 'Giấy tờ nguồn không còn hợp lệ' USING ERRCODE = 'PT422';
  END IF;
  IF public.citizen_vault_restricted(p_version_id) THEN
    RAISE EXCEPTION 'Tài liệu đang được hạn chế theo quyết định lưu trữ' USING ERRCODE = 'PT403';
  END IF;
  IF p_document_code <> 'other' AND NOT EXISTS (SELECT 1 FROM procedure_documents
       WHERE procedure_id = v_app.procedure_id AND document_code = p_document_code) THEN
    RAISE EXCEPTION 'Loại giấy tờ không thuộc thủ tục' USING ERRCODE = 'PT422';
  END IF;
  IF (SELECT count(*) FROM application_documents WHERE application_id = p_application_id) >= 30 THEN
    RAISE EXCEPTION 'Hồ sơ chỉ cho phép tối đa 30 tệp' USING ERRCODE = 'PT422';
  END IF;
  INSERT INTO application_documents(application_id, document_code, original_name, storage_key, mime_type, size_bytes, sha256)
  VALUES (p_application_id, p_document_code, p_original_name, p_storage_key, p_mime_type, p_size_bytes, p_sha256)
  RETURNING id, document_code, original_name, size_bytes, uploaded_at INTO v_row;
  INSERT INTO citizen_vault_shares(citizen_id, tenant_id, version_id, application_id, attachment_id, document_code)
  VALUES (v_citizen, v_tenant, p_version_id, p_application_id, v_row.id, p_document_code);
  PERFORM public.citizen_record_access('share_vault_to_case', 'Chia sẻ giấy tờ theo xác nhận cho hồ sơ mới',
    'application', p_application_id);
  RETURN row_to_json(v_row);
END $$;

-- ===== 5. Tự điền biểu mẫu =====
-- Dữ liệu gốc để Kênh người dân tính đề xuất (shared/citizen-autofill.ts); ghi nhật ký sử dụng dữ liệu cá nhân.
CREATE OR REPLACE FUNCTION api.citizen_autofill_sources() RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_citizen uuid;
  v_tenant uuid;
BEGIN
  SELECT a.citizen_id, a.tenant_id INTO v_citizen, v_tenant FROM public.citizen_actor() a;
  PERFORM public.citizen_record_access('read_autofill', 'Đề xuất dữ liệu kê khai theo yêu cầu công dân', 'autofill', '');
  RETURN json_build_object(
    'profile', (SELECT json_build_object('display_name', display_name, 'phone', phone, 'address', address)
                FROM citizens WHERE id = v_citizen),
    'self', (SELECT json_build_object('birth_date', to_char(birth_date, 'YYYY-MM-DD'), 'citizen_identifier', citizen_identifier)
             FROM citizen_self_facts WHERE citizen_id = v_citizen),
    'verified', coalesce((SELECT json_agg(json_build_object('field_key', field_key, 'field_value', field_value,
                  'source_issuer', source_issuer, 'verified_at', verified_at))
                FROM citizen_verified_facts WHERE citizen_id = v_citizen), '[]'::json));
END $$;

-- Lưu ngày sinh, số định danh công dân tự khai (chưa xác minh). Chuỗi rỗng là xóa.
CREATE OR REPLACE FUNCTION api.citizen_self_facts_update(p_birth_date date, p_citizen_identifier text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_citizen uuid;
  v_tenant uuid;
BEGIN
  SELECT a.citizen_id, a.tenant_id INTO v_citizen, v_tenant FROM public.citizen_actor() a;
  INSERT INTO citizen_self_facts(citizen_id, tenant_id, birth_date, citizen_identifier)
  VALUES (v_citizen, v_tenant, p_birth_date, nullif(p_citizen_identifier, ''))
  ON CONFLICT (citizen_id) DO UPDATE SET birth_date = EXCLUDED.birth_date,
    citizen_identifier = EXCLUDED.citizen_identifier, updated_at = now();
  RETURN json_build_object('ok', true, 'notice', 'Dữ liệu tự khai, chưa xác minh qua cơ quan định danh');
END $$;

-- ===== 6. Quyền gọi =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.citizen_active_consent(text)', 'public.citizen_vault_restricted(uuid)', 'public.today_vietnam()',
    'public.check_text(text, text, integer, integer)'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['api.citizen_vault()',
    'api.citizen_vault_add(uuid, text, text, text, text, text, integer, text, date)',
    'api.citizen_vault_update(uuid, text, text, boolean)', 'api.citizen_vault_version_update(uuid, date)',
    'api.citizen_vault_file(uuid)', 'api.citizen_vault_source(uuid)',
    'api.citizen_vault_attach(text, uuid, text, text, text, text, integer, text)',
    'api.citizen_autofill_sources()', 'api.citizen_self_facts_update(date, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
