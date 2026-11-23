-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API của lõi cho luồng chính của Kênh người dân, gọi qua cổng APISIX:
--   thủ tục (cả khách chưa đăng nhập), hồ sơ của tôi, bản nháp, nộp hồ sơ, giấy tờ, thông báo,
--   hồ sơ cá nhân.
-- Mọi hàm chạy bằng quyền của người gọi (SECURITY INVOKER): vai trò "citizen-app" với biến
-- app.citizen_id, app.tenant_id do rest_pre_request() đặt từ token, nên các chính sách RLS sẵn có
-- quyết định công dân thấy và sửa được gì. Ràng buộc nghiệp vụ (trạng thái, phiên bản thủ tục,
-- xã có mở thủ tục, tuyến tiếp nhận, quyền đại diện, đủ giấy tờ bắt buộc) kiểm tra lại ở đây,
-- trong cùng giao dịch với lệnh ghi. Kiểm tra từng trường biểu mẫu do Kênh người dân làm
-- trước khi gọi (shared/procedure-forms.ts).
-- Lỗi nghiệp vụ dùng mã PTxyz: PostgREST trả đúng mã HTTP xyz kèm lời nhắn.
-- Mọi hàm đặt search_path = public: PostgREST chạy với search_path = api, nơi có view cùng tên bảng.
-- Chạy lại nhiều lần được.

-- ===== 1. Vai trò cho khách chưa đăng nhập (chỉ xem danh mục thủ tục) =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
  IF NOT pg_has_role('authenticator', 'web_anon', 'MEMBER') THEN
    GRANT web_anon TO authenticator;
  END IF;
END $$;
GRANT USAGE ON SCHEMA api TO web_anon;
GRANT EXECUTE ON FUNCTION public.rest_pre_request() TO web_anon;
GRANT SELECT ON procedures, procedure_documents TO web_anon;
GRANT EXECUTE ON FUNCTION public.procedure_enabled_for(uuid, text) TO web_anon;

-- ===== 2. Quyền bảng của citizen-app: chép đúng quyền communeos_app đang có =====
-- Chỉ các bảng của luồng chính; quyền theo cột chép theo cột. RLS vẫn áp dụng.
DO $$
DECLARE
  t text; r record;
  tables text[] := ARRAY['applications','application_events','application_documents','citizen_notifications',
    'citizens','procedures','procedure_documents','citizen_procedure_versions','citizen_procedure_receivers',
    'citizen_representations','citizen_representation_audit','citizen_draft_cursors',
    'citizen_service_batches','citizen_service_batch_items','citizen_data_access_events','tenants'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    FOR r IN SELECT privilege_type FROM information_schema.role_table_grants
             WHERE grantee = 'communeos_app' AND table_schema = 'public' AND table_name = t LOOP
      EXECUTE format('GRANT %s ON public.%I TO "citizen-app"', r.privilege_type, t);
    END LOOP;
    FOR r IN SELECT privilege_type, string_agg(quote_ident(column_name), ',') AS cols
             FROM information_schema.column_privileges
             WHERE grantee = 'communeos_app' AND table_schema = 'public' AND table_name = t
             GROUP BY privilege_type LOOP
      EXECUTE format('GRANT %s (%s) ON public.%I TO "citizen-app"', r.privilege_type, r.cols, t);
    END LOOP;
  END LOOP;
END $$;
-- Xóa giấy tờ của bản nháp (chính sách document_owner_policy cho phép theo chủ hồ sơ).
GRANT DELETE ON application_documents TO "citizen-app";
GRANT USAGE ON SEQUENCE citizen_case_number, application_events_id_seq,
  citizen_representation_audit_id_seq, citizen_data_access_events_id_seq TO "citizen-app";
GRANT EXECUTE ON FUNCTION public.procedure_enabled_for(uuid, text) TO "citizen-app";
GRANT EXECUTE ON FUNCTION public.lock_procedure_shared(text) TO "citizen-app";

-- ===== 3. Hàm phụ (schema public, không lộ ra API) =====
CREATE OR REPLACE FUNCTION public.citizen_fail(p_status int, p_message text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION '%', p_message USING ERRCODE = 'PT' || p_status::text;
END $$;

-- Công dân đang gọi (id, xã, tên hiển thị); chưa có thì 401.
CREATE OR REPLACE FUNCTION public.citizen_actor(OUT citizen_id uuid, OUT tenant_id uuid, OUT display_name text)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  citizen_id := nullif(current_setting('app.citizen_id', true), '')::uuid;
  tenant_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
  IF citizen_id IS NULL OR tenant_id IS NULL THEN
    PERFORM public.citizen_fail(401, 'Vui lòng đăng nhập tài khoản Công dân');
  END IF;
  SELECT c.display_name INTO display_name FROM citizens c WHERE c.id = citizen_actor.citizen_id;
  IF display_name IS NULL THEN
    PERFORM public.citizen_fail(401, 'Vui lòng đăng nhập tài khoản Công dân');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.citizen_same_name(a text, b text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT lower(normalize(btrim(coalesce(a, '')), NFC)) = lower(normalize(btrim(coalesce(b, '')), NFC)) $$;

-- Xã tiếp nhận khác xã của công dân chỉ hợp lệ khi có tuyến tiếp nhận đang hiệu lực.
CREATE OR REPLACE FUNCTION public.citizen_receiver_permitted(p_procedure text, p_source uuid, p_receiving uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p_source = p_receiving OR EXISTS (
    SELECT 1 FROM citizen_procedure_receivers
    WHERE procedure_id = p_procedure AND source_tenant_id = p_source AND receiving_tenant_id = p_receiving
      AND enabled = true AND trim(approval_reference) <> '' AND valid_until > now())
$$;

-- Người kê khai phải là chính công dân, hoặc người được đại diện đã xác minh cho đúng thủ tục.
CREATE OR REPLACE FUNCTION public.citizen_check_applicant(p_representation uuid, p_procedure text, p_name text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF p_representation IS NULL THEN
    SELECT display_name INTO v_name FROM citizens WHERE id = (public.citizen_actor()).citizen_id;
    IF NOT public.citizen_same_name(v_name, p_name) THEN
      PERFORM public.citizen_fail(422, 'Họ tên người kê khai không khớp hồ sơ cá nhân; để làm thay người khác, vui lòng đăng ký đại diện');
    END IF;
    RETURN;
  END IF;
  SELECT represented_name INTO v_name FROM citizen_representations
  WHERE id = p_representation AND procedure_id = p_procedure AND status = 'verified' AND evidence_key IS NOT NULL
    AND valid_until >= CURRENT_DATE AND verified_at IS NOT NULL AND verified_by IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.citizen_fail(403, 'Quyền đại diện chưa được xác minh, đã hết hạn hoặc không đúng thủ tục');
  END IF;
  IF NOT public.citizen_same_name(v_name, p_name) THEN
    PERFORM public.citizen_fail(422, 'Tên người được đại diện không khớp thông tin đã được xác minh');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.citizen_latest_version(p_procedure text) RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v uuid;
BEGIN
  SELECT id INTO v FROM citizen_procedure_versions WHERE procedure_id = p_procedure ORDER BY version_no DESC LIMIT 1;
  IF v IS NULL THEN PERFORM public.citizen_fail(409, 'Chưa có phiên bản thủ tục được đăng ký'); END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.citizen_record_access(p_action text, p_purpose text, p_kind text, p_reference text) RETURNS void
LANGUAGE sql SET search_path = public AS $$
  INSERT INTO citizen_data_access_events(citizen_id, tenant_id, action, purpose, processing_unit, resource_kind, resource_reference, actor_kind)
  SELECT a.citizen_id, a.tenant_id, p_action, p_purpose, 'Cổng công dân CommuneOS', p_kind, coalesce(p_reference, ''), 'citizen'
  FROM public.citizen_actor() a
$$;

-- Chuỗi tìm kiếm không dấu (giống translate() của bản cũ).
CREATE OR REPLACE FUNCTION public.citizen_fold(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT translate(lower(coalesce(p, '')),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
$$;

-- ===== 4. Thủ tục (khách và công dân) =====
CREATE OR REPLACE FUNCTION api.procedure_catalog(p_q text DEFAULT '', p_category text DEFAULT '') RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(json_agg(x ORDER BY x.title), '[]'::json) FROM (
    SELECT p.*, (SELECT count(*)::int FROM procedure_documents d WHERE d.procedure_id = p.id) AS document_count
    FROM procedures p
    WHERE p.published
      AND (coalesce(p_q, '') = '' OR p.title ILIKE '%' || left(p_q, 120) || '%' OR p.summary ILIKE '%' || left(p_q, 120) || '%')
      AND (coalesce(p_category, '') = '' OR p.category = p_category)
      -- Công dân đã đăng nhập chỉ thấy thủ tục xã mình đang mở; khách thấy mọi thủ tục đã công bố.
      AND (nullif(current_setting('app.tenant_id', true), '') IS NULL
           OR public.procedure_enabled_for(nullif(current_setting('app.tenant_id', true), '')::uuid, p.id))
  ) x
$$;

CREATE OR REPLACE FUNCTION api.procedure_detail(p_procedure_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_proc json; v_docs json; v_tenant uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
BEGIN
  SELECT row_to_json(p) INTO v_proc FROM procedures p WHERE p.id = p_procedure_id AND p.published;
  IF v_proc IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy thủ tục'); END IF;
  SELECT coalesce(json_agg(json_build_object('document_code', document_code, 'document_name', document_name,
    'is_required', is_required) ORDER BY document_code), '[]'::json)
  INTO v_docs FROM procedure_documents WHERE procedure_id = p_procedure_id;
  RETURN (v_proc::jsonb || jsonb_build_object('documents', v_docs,
    'available_in_my_commune', CASE WHEN v_tenant IS NULL THEN NULL ELSE public.procedure_enabled_for(v_tenant, p_procedure_id) END))::json;
END $$;

-- ===== 5. Hồ sơ cá nhân =====
CREATE OR REPLACE FUNCTION api.citizen_profile() RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v json; a record := public.citizen_actor();
BEGIN
  SELECT json_build_object('id', c.id, 'tenant_id', c.tenant_id, 'display_name', c.display_name, 'email', c.email,
    'phone', c.phone, 'address', c.address, 'tenant_name', t.name)
  INTO v FROM citizens c JOIN tenants t ON c.tenant_id = t.id WHERE c.id = a.citizen_id;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Không có tài khoản Công dân'); END IF;
  PERFORM public.citizen_record_access('view_profile', 'Xem thông tin hồ sơ cá nhân', 'profile', '');
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.citizen_profile_update(p_display_name text, p_email text, p_phone text, p_address text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF length(btrim(coalesce(p_display_name, ''))) NOT BETWEEN 2 AND 100 OR length(coalesce(p_email, '')) > 150
     OR length(coalesce(p_phone, '')) > 25 OR length(coalesce(p_address, '')) > 250 THEN
    PERFORM public.citizen_fail(422, 'Thông tin hồ sơ cá nhân không hợp lệ');
  END IF;
  UPDATE citizens SET display_name = btrim(p_display_name), email = btrim(coalesce(p_email, '')),
    phone = btrim(coalesce(p_phone, '')), address = btrim(coalesce(p_address, ''))
  WHERE id = a.citizen_id;
  RETURN json_build_object('ok', true, 'display_name', btrim(p_display_name));
END $$;

-- ===== 6. Thông báo =====
CREATE OR REPLACE FUNCTION api.citizen_notifications(p_paged boolean DEFAULT false, p_q text DEFAULT '',
  p_category text DEFAULT '', p_unread boolean DEFAULT false, p_page int DEFAULT 1) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  a record := public.citizen_actor();
  v_q text := left(btrim(coalesce(p_q, '')), 100);
  v_cat text := CASE WHEN coalesce(p_category, '') ~ '^[a-z0-9_-]{1,30}$' THEN p_category ELSE '' END;
  v_size int := 15;
BEGIN
  IF NOT coalesce(p_paged, false) THEN
    RETURN (SELECT coalesce(json_agg(n ORDER BY n.created_at DESC), '[]'::json)
            FROM (SELECT * FROM citizen_notifications ORDER BY created_at DESC LIMIT 100) n);
  END IF;
  RETURN (
    WITH m AS (
      SELECT * FROM citizen_notifications n
      WHERE (v_q = '' OR position(lower(v_q) IN lower(n.title)) > 0 OR position(lower(v_q) IN lower(n.body)) > 0)
        AND (v_cat = '' OR n.category = v_cat) AND (NOT coalesce(p_unread, false) OR NOT n.is_read)),
    t AS (SELECT count(*)::int AS total FROM m),
    pg AS (SELECT total, least(greatest(coalesce(p_page, 1), 1), greatest(1, ceil(total / v_size::numeric)::int)) AS page FROM t)
    SELECT json_build_object(
      'items', (SELECT coalesce(json_agg(x ORDER BY x.created_at DESC, x.id DESC), '[]'::json) FROM (
                 SELECT * FROM m ORDER BY created_at DESC, id DESC LIMIT v_size OFFSET (pg.page - 1) * v_size) x),
      'page', pg.page, 'pageSize', v_size, 'total', pg.total,
      'unreadCount', (SELECT count(*)::int FROM citizen_notifications WHERE NOT is_read),
      'categories', (SELECT coalesce(json_agg(c ORDER BY c.category), '[]'::json) FROM (
                 SELECT category, count(*)::int AS count FROM citizen_notifications GROUP BY category) c))
    FROM pg);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_notification_read(p_notification_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  UPDATE citizen_notifications SET is_read = true WHERE id = p_notification_id;
  RETURN json_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_notifications_read_all() RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  UPDATE citizen_notifications SET is_read = true WHERE is_read = false;
  RETURN json_build_object('ok', true);
END $$;

-- ===== 7. Hồ sơ của tôi =====
CREATE OR REPLACE FUNCTION api.citizen_applications(p_status text DEFAULT '', p_term text DEFAULT '',
  p_paged boolean DEFAULT false, p_page int DEFAULT 1) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  a record := public.citizen_actor();
  v_status text := CASE WHEN p_status IN ('draft','submitted','processing','supplement','completed','rejected','withdrawn') THEN p_status ELSE '' END;
  v_term text := public.citizen_fold(left(btrim(coalesce(p_term, '')), 100));
  v_size int := 10;
BEGIN
  RETURN (
    WITH m AS (
      SELECT ap.id, ap.procedure_id, p.title AS procedure_title, p.category, ap.status, ap.applicant_name,
             ap.applicant_phone, ap.description, ap.form_data, ap.submitted_at, ap.due_at, ap.result_note, ap.updated_at
      FROM applications ap JOIN procedures p ON ap.procedure_id = p.id
      WHERE (v_status = '' OR ap.status = v_status)
        AND (v_term = '' OR position(v_term IN public.citizen_fold(ap.id)) > 0
             OR position(v_term IN public.citizen_fold(p.title)) > 0
             OR position(v_term IN public.citizen_fold(ap.applicant_name)) > 0)),
    t AS (SELECT count(*)::int AS total FROM m),
    pg AS (SELECT total, least(greatest(coalesce(p_page, 1), 1), greatest(1, ceil(total / v_size::numeric)::int)) AS page FROM t)
    SELECT CASE WHEN NOT coalesce(p_paged, false) THEN
      (SELECT coalesce(json_agg(x ORDER BY x.updated_at DESC, x.id DESC), '[]'::json) FROM (
         SELECT * FROM m ORDER BY updated_at DESC, id DESC LIMIT 100) x)
    ELSE json_build_object(
      'items', (SELECT coalesce(json_agg(x ORDER BY x.updated_at DESC, x.id DESC), '[]'::json) FROM (
                 SELECT * FROM m ORDER BY updated_at DESC, id DESC LIMIT v_size OFFSET (pg.page - 1) * v_size) x),
      'total', pg.total, 'page', pg.page, 'pageSize', v_size,
      'counts', (SELECT jsonb_build_object('draft',0,'submitted',0,'processing',0,'supplement',0,'completed',0,'rejected',0,'withdrawn',0)
                   || coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                 FROM (SELECT status, count(*)::int AS n FROM applications
                       WHERE status IN ('draft','submitted','processing','supplement','completed','rejected','withdrawn')
                       GROUP BY status) g))
    END FROM pg);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_application(p_application_id text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v jsonb; v_proc text; a record := public.citizen_actor();
BEGIN
  SELECT to_jsonb(ap) || jsonb_build_object('procedure_title', p.title, 'category', p.category), ap.procedure_id
  INTO v, v_proc FROM applications ap JOIN procedures p ON p.id = ap.procedure_id WHERE ap.id = p_application_id;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Hồ sơ không tồn tại hoặc bạn không có quyền xem'); END IF;
  v := v || jsonb_build_object(
    'events', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'event_type', event_type, 'note', note,
                 'actor_name', actor_name, 'created_at', created_at) ORDER BY created_at, id), '[]'::jsonb)
               FROM application_events WHERE application_id = p_application_id),
    'documents', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'document_code', document_code,
                 'original_name', original_name, 'size_bytes', size_bytes, 'uploaded_at', uploaded_at) ORDER BY uploaded_at DESC), '[]'::jsonb)
               FROM application_documents WHERE application_id = p_application_id),
    'requirements', (SELECT coalesce(jsonb_agg(jsonb_build_object('document_code', document_code,
                 'document_name', document_name, 'is_required', is_required) ORDER BY document_code), '[]'::jsonb)
               FROM procedure_documents WHERE procedure_id = v_proc));
  PERFORM public.citizen_record_access('view_case', 'Tra cứu hồ sơ cá nhân', 'application', p_application_id);
  RETURN v::json;
END $$;

-- Dữ liệu bản nháp để Kênh người dân kiểm tra biểu mẫu trước khi lưu hoặc nộp.
CREATE OR REPLACE FUNCTION api.citizen_application_draft(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v json; a record := public.citizen_actor();
BEGIN
  SELECT json_build_object('id', id, 'procedure_id', procedure_id, 'status', status, 'form_data', form_data,
    'applicant_name', applicant_name, 'applicant_phone', applicant_phone, 'representation_id', representation_id,
    'receiving_tenant_id', receiving_tenant_id, 'updated_at', updated_at)
  INTO v FROM applications WHERE id = p_application_id;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  RETURN v;
END $$;

-- ===== 8. Bản nháp: tạo, sửa, tự lưu =====
CREATE OR REPLACE FUNCTION api.citizen_application_create(p_procedure_id text, p_applicant_name text, p_phone text,
  p_description text, p_form_data jsonb, p_receiving_tenant_id uuid DEFAULT NULL, p_representation_id uuid DEFAULT NULL,
  p_batch_id uuid DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  a record := public.citizen_actor();
  v_receiving uuid := coalesce(p_receiving_tenant_id, a.tenant_id);
  v_version uuid; v_id text;
BEGIN
  IF NOT public.citizen_receiver_permitted(p_procedure_id, a.tenant_id, v_receiving) THEN
    PERFORM public.citizen_fail(422, 'Địa phương tiếp nhận chưa được cho phép đối với thủ tục này');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM procedures WHERE id = p_procedure_id AND published) THEN
    PERFORM public.citizen_fail(400, 'Thủ tục không tồn tại');
  END IF;
  IF NOT public.procedure_enabled_for(v_receiving, p_procedure_id) THEN
    PERFORM public.citizen_fail(422, 'Xã tiếp nhận chưa mở thủ tục này. Vui lòng chọn thủ tục khác hoặc liên hệ UBND xã.');
  END IF;
  v_version := public.citizen_latest_version(p_procedure_id);
  PERFORM public.citizen_check_applicant(p_representation_id, p_procedure_id, p_applicant_name);
  v_id := 'HS-' || extract(year FROM now())::int || '-' || lpad(nextval('citizen_case_number')::text, 6, '0');
  INSERT INTO applications(id, citizen_id, tenant_id, procedure_id, status, applicant_name, applicant_phone, description,
    form_data, submitted_at, due_at, receiving_tenant_id, representation_id, procedure_version_id, acknowledged_procedure_version_id)
  VALUES (v_id, a.citizen_id, a.tenant_id, p_procedure_id, 'draft', p_applicant_name, coalesce(p_phone, ''),
    coalesce(p_description, ''), coalesce(p_form_data, '{}'::jsonb), NULL, NULL, v_receiving, p_representation_id, v_version, v_version);
  IF p_batch_id IS NOT NULL THEN
    UPDATE citizen_service_batch_items i SET application_id = v_id
    FROM citizen_service_batches b
    WHERE i.batch_id = b.id AND b.id = p_batch_id AND b.citizen_id = a.citizen_id AND b.tenant_id = a.tenant_id
      AND i.procedure_id = p_procedure_id AND i.application_id IS NULL;
    IF NOT FOUND THEN
      PERFORM public.citizen_fail(409, 'Nhóm thủ tục không hợp lệ hoặc đã có hồ sơ cho thủ tục này');
    END IF;
  END IF;
  IF p_representation_id IS NOT NULL THEN
    INSERT INTO citizen_representation_audit(representation_id, citizen_id, tenant_id, action, application_id, actor_name)
    VALUES (p_representation_id, a.citizen_id, a.tenant_id, 'application_created', v_id, a.display_name);
  END IF;
  RETURN json_build_object('id', v_id, 'status', 'draft');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_application_update(p_application_id text, p_procedure_id text, p_applicant_name text,
  p_phone text, p_description text, p_form_data jsonb, p_receiving_tenant_id uuid DEFAULT NULL,
  p_representation_id uuid DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  a record := public.citizen_actor();
  v_receiving uuid := coalesce(p_receiving_tenant_id, a.tenant_id);
  v_status text; v_proc text;
BEGIN
  IF NOT public.citizen_receiver_permitted(p_procedure_id, a.tenant_id, v_receiving) THEN
    PERFORM public.citizen_fail(422, 'Địa phương tiếp nhận chưa được cho phép đối với thủ tục này');
  END IF;
  SELECT status, procedure_id INTO v_status, v_proc FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'draft' OR v_proc IS DISTINCT FROM p_procedure_id THEN
    PERFORM public.citizen_fail(409, 'Không thể sửa hồ sơ đã nộp hoặc khác thủ tục');
  END IF;
  PERFORM public.citizen_check_applicant(p_representation_id, p_procedure_id, p_applicant_name);
  UPDATE applications SET applicant_name = p_applicant_name, applicant_phone = coalesce(p_phone, ''),
    description = coalesce(p_description, ''), form_data = coalesce(p_form_data, '{}'::jsonb),
    receiving_tenant_id = v_receiving, representation_id = p_representation_id, updated_at = now()
  WHERE id = p_application_id;
  UPDATE citizen_draft_cursors SET revision = revision + 1, updated_at = now() WHERE application_id = p_application_id;
  RETURN json_build_object('id', p_application_id, 'status', 'draft');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_application_autosave(p_application_id text, p_form_data jsonb, p_expected_revision int) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_status text; v_revision int;
BEGIN
  SELECT status INTO v_status FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'draft' THEN PERFORM public.citizen_fail(409, 'Bản nháp không còn có thể lưu'); END IF;
  SELECT revision INTO v_revision FROM citizen_draft_cursors WHERE application_id = p_application_id FOR UPDATE;
  IF coalesce(v_revision, 0) <> p_expected_revision THEN
    PERFORM public.citizen_fail(409, 'Bản nháp đã được sửa trên thiết bị khác. Hãy tải lại trước khi tiếp tục.');
  END IF;
  UPDATE applications SET form_data = coalesce(p_form_data, '{}'::jsonb), updated_at = now() WHERE id = p_application_id;
  INSERT INTO citizen_draft_cursors(application_id, citizen_id, tenant_id, revision)
  VALUES (p_application_id, a.citizen_id, a.tenant_id, coalesce(v_revision, 0) + 1)
  ON CONFLICT (application_id) DO UPDATE SET revision = EXCLUDED.revision, updated_at = now();
  RETURN json_build_object('applicationId', p_application_id, 'revision', coalesce(v_revision, 0) + 1, 'savedAt', now(),
    'notice', 'Đã lưu trên máy chủ. Phải rà soát trước khi nộp.');
END $$;

-- ===== 9. Nộp hồ sơ =====
-- p_expected_updated_at: thời điểm sửa bản nháp mà Kênh người dân đã kiểm tra biểu mẫu;
-- bản nháp đổi sau đó thì từ chối để không nộp dữ liệu chưa được kiểm tra.
CREATE OR REPLACE FUNCTION api.citizen_application_submit(p_application_id text, p_expected_updated_at timestamptz) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  a record := public.citizen_actor();
  r applications%ROWTYPE; v_version uuid; v_receiving uuid; v_missing text;
BEGIN
  SELECT * INTO r FROM applications WHERE id = p_application_id;
  IF NOT FOUND THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  -- Khóa thủ tục trước, cùng thứ tự với lúc công bố phiên bản mới.
  PERFORM public.lock_procedure_shared(r.procedure_id);
  SELECT * INTO r FROM applications WHERE id = p_application_id FOR UPDATE;
  IF r.status IS DISTINCT FROM 'draft' THEN PERFORM public.citizen_fail(409, 'Hồ sơ không ở trạng thái bản nháp'); END IF;
  IF p_expected_updated_at IS NULL OR r.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    PERFORM public.citizen_fail(409, 'Bản nháp vừa được thay đổi. Vui lòng tải lại trang và kiểm tra trước khi nộp.');
  END IF;
  v_version := public.citizen_latest_version(r.procedure_id);
  IF r.acknowledged_procedure_version_id IS DISTINCT FROM v_version THEN
    PERFORM public.citizen_fail(409, 'Quy định thủ tục đã thay đổi. Vui lòng xem nội dung thay đổi và xác nhận phiên bản mới trước khi nộp.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM procedures WHERE id = r.procedure_id AND published) THEN
    PERFORM public.citizen_fail(409, 'Thủ tục không còn được công bố; vui lòng chọn thủ tục khác');
  END IF;
  v_receiving := coalesce(r.receiving_tenant_id, a.tenant_id);
  IF NOT public.citizen_receiver_permitted(r.procedure_id, a.tenant_id, v_receiving) THEN
    PERFORM public.citizen_fail(409, 'Tuyến tiếp nhận không còn hiệu lực; vui lòng chỉnh sửa bản nháp và chọn lại địa phương');
  END IF;
  IF NOT public.procedure_enabled_for(v_receiving, r.procedure_id) THEN
    PERFORM public.citizen_fail(409, 'Xã tiếp nhận đã ngừng nhận hồ sơ cho thủ tục này');
  END IF;
  PERFORM public.citizen_check_applicant(r.representation_id, r.procedure_id, r.applicant_name);
  -- Poka-yoke: thiếu giấy tờ bắt buộc thì không nộp được.
  SELECT string_agg(d.document_name, ', ' ORDER BY d.document_code) INTO v_missing FROM procedure_documents d
  WHERE d.procedure_id = r.procedure_id AND d.is_required AND NOT EXISTS (
    SELECT 1 FROM application_documents f WHERE f.application_id = r.id AND f.document_code = d.document_code);
  IF v_missing IS NOT NULL THEN PERFORM public.citizen_fail(422, 'Thiếu giấy tờ: ' || v_missing); END IF;
  -- NULLIF turns an unverified demo SLA (0) into NULL instead of a fake due date.
  UPDATE applications SET status = 'submitted', submitted_at = now(), updated_at = now(),
    due_at = CURRENT_DATE + (SELECT NULLIF(sla_days, 0) FROM procedures WHERE id = r.procedure_id),
    submitted_procedure_version_id = v_version
  WHERE id = r.id;
  INSERT INTO application_events(application_id, event_type, note, actor_name)
  VALUES (r.id, 'submitted', 'Công dân đã nộp hồ sơ và xác nhận đầy đủ giấy tờ.', a.display_name);
  IF r.representation_id IS NOT NULL THEN
    INSERT INTO citizen_representation_audit(representation_id, citizen_id, tenant_id, action, application_id, actor_name)
    VALUES (r.representation_id, a.citizen_id, a.tenant_id, 'application_submitted', r.id, a.display_name);
  END IF;
  INSERT INTO citizen_notifications(citizen_id, tenant_id, application_id, title, body)
  VALUES (a.citizen_id, a.tenant_id, r.id, 'Nộp hồ sơ thành công', 'Hồ sơ ' || r.id || ' đã được ghi nhận.');
  RETURN json_build_object('id', r.id, 'status', 'submitted');
END $$;

-- ===== 10. Giấy tờ của hồ sơ =====
-- Tệp đã được Kênh người dân kiểm tra định dạng và lưu vào kho đối tượng của lõi; hàm này
-- chỉ ghi siêu dữ liệu. Khóa tệp (storage_key) không bao giờ trả cho trình duyệt.
CREATE OR REPLACE FUNCTION api.citizen_document_add(p_application_id text, p_document_code text, p_original_name text,
  p_storage_key text, p_mime_type text, p_size_bytes int, p_sha256 text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_status text; v_proc text; v json;
BEGIN
  SELECT status, procedure_id INTO v_status, v_proc FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS NULL OR v_status NOT IN ('draft', 'supplement') THEN
    PERFORM public.citizen_fail(403, 'Hồ sơ không cho phép tải tài liệu');
  END IF;
  IF p_document_code IS DISTINCT FROM 'other' AND NOT EXISTS (
       SELECT 1 FROM procedure_documents WHERE procedure_id = v_proc AND document_code = p_document_code) THEN
    PERFORM public.citizen_fail(400, 'Loại giấy tờ không hợp lệ');
  END IF;
  IF (SELECT count(*) FROM application_documents WHERE application_id = p_application_id) >= 30 THEN
    PERFORM public.citizen_fail(422, 'Hồ sơ tối đa 30 tệp; vui lòng liên hệ hỗ trợ nếu cần bổ sung');
  END IF;
  IF p_mime_type NOT IN ('application/pdf', 'image/png', 'image/jpeg') OR p_size_bytes NOT BETWEEN 1 AND 5242880
     OR coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' OR coalesce(p_storage_key, '') !~ '^[0-9a-f-]{36}\.(pdf|png|jpg)$' THEN
    PERFORM public.citizen_fail(400, 'Thông tin tệp không hợp lệ');
  END IF;
  INSERT INTO application_documents(application_id, document_code, original_name, storage_key, mime_type, size_bytes, sha256)
  VALUES (p_application_id, p_document_code, left(regexp_replace(coalesce(p_original_name, 'tai-lieu'), '[\\/\r\n\x01-\x1f]', '', 'g'), 180),
    p_storage_key, p_mime_type, p_size_bytes, p_sha256)
  RETURNING json_build_object('id', id, 'document_code', document_code, 'original_name', original_name,
    'size_bytes', size_bytes, 'uploaded_at', uploaded_at) INTO v;
  RETURN v;
END $$;

-- Xóa giấy tờ của bản nháp hoặc hồ sơ đang bổ sung; trả khóa tệp để Kênh người dân xóa trong kho.
CREATE OR REPLACE FUNCTION api.citizen_document_remove(p_application_id text, p_document_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_status text; v_key text;
BEGIN
  SELECT status INTO v_status FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  IF v_status NOT IN ('draft', 'supplement') THEN PERFORM public.citizen_fail(409, 'Không được xóa tài liệu của hồ sơ đã nộp'); END IF;
  DELETE FROM application_documents WHERE id = p_document_id AND application_id = p_application_id RETURNING storage_key INTO v_key;
  IF v_key IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy tài liệu của hồ sơ'); END IF;
  RETURN json_build_object('storage_key', v_key);
END $$;

-- Siêu dữ liệu để Kênh người dân tải tệp từ kho; ghi nhật ký sử dụng dữ liệu cá nhân.
CREATE OR REPLACE FUNCTION api.citizen_document_file(p_document_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v json;
BEGIN
  SELECT json_build_object('storage_key', storage_key, 'original_name', original_name, 'mime_type', mime_type)
  INTO v FROM application_documents WHERE id = p_document_id;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy tệp có quyền truy cập'); END IF;
  PERFORM public.citizen_record_access('download_case_attachment', 'Xem tài liệu hồ sơ', 'application_document', p_document_id::text);
  RETURN v;
END $$;

-- ===== 11. Quyền gọi =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.citizen_fail(int,text)', 'public.citizen_actor()', 'public.citizen_same_name(text,text)',
    'public.citizen_receiver_permitted(text,uuid,uuid)', 'public.citizen_check_applicant(uuid,text,text)',
    'public.citizen_latest_version(text)', 'public.citizen_record_access(text,text,text,text)', 'public.citizen_fold(text)',
    'api.citizen_profile()', 'api.citizen_profile_update(text,text,text,text)',
    'api.citizen_notifications(boolean,text,text,boolean,int)', 'api.citizen_notification_read(uuid)',
    'api.citizen_notifications_read_all()', 'api.citizen_applications(text,text,boolean,int)',
    'api.citizen_application(text)', 'api.citizen_application_draft(text)',
    'api.citizen_application_create(text,text,text,text,jsonb,uuid,uuid,uuid)',
    'api.citizen_application_update(text,text,text,text,text,jsonb,uuid,uuid)',
    'api.citizen_application_autosave(text,jsonb,int)', 'api.citizen_application_submit(text,timestamptz)',
    'api.citizen_document_add(text,text,text,text,text,int,text)', 'api.citizen_document_remove(text,uuid)',
    'api.citizen_document_file(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['api.procedure_catalog(text,text)', 'api.procedure_detail(text)', 'public.citizen_fail(int,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO web_anon, "citizen-app"', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
