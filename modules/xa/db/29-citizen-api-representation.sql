-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API của lõi cho đại diện nộp thay (đăng ký, minh chứng, thu hồi, nhật ký), nộp theo nhóm thủ tục và trang gia đình
-- của Kênh người dân. Gọi qua cổng APISIX (POST /rest/rpc/<tên hàm>) bằng token Keycloak của công dân.
-- SECURITY INVOKER, RLS theo công dân do rest_pre_request() đặt; mỗi giao dịch của API cũ là một hàm.
-- Tệp minh chứng do Kênh người dân kiểm tra định dạng và lưu vào kho đối tượng của lõi; hàm chỉ ghi khóa tệp.
-- Trang gia đình chỉ hiện hồ sơ chính tài khoản đã nộp theo quyền đại diện đã xác minh, không mở hồ sơ riêng của
-- người thân. Chạy lại nhiều lần được.

-- ===== 1. Đại diện nộp thay =====
CREATE OR REPLACE FUNCTION api.citizen_representations() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object('items', coalesce((SELECT json_agg(r ORDER BY r.updated_at DESC) FROM (
    SELECT r.id, r.represented_name, r.relationship, r.legal_basis, r.authorization_reference, r.procedure_id,
      p.title AS procedure_title, r.valid_until, r.status, r.verified_at, r.evidence_name, r.created_at, r.updated_at
    FROM citizen_representations r JOIN procedures p ON p.id = r.procedure_id
    ORDER BY r.updated_at DESC LIMIT 100) r), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_representation_create(p_represented_name text, p_relationship text, p_legal_basis text,
  p_authorization_reference text, p_procedure_id text, p_valid_until date) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_row record;
BEGIN
  IF p_relationship NOT IN ('parent', 'child', 'spouse', 'guardian', 'other') THEN PERFORM public.citizen_fail(400, 'Quan hệ không hợp lệ'); END IF;
  IF p_legal_basis NOT IN ('authorization', 'legal_representative') THEN PERFORM public.citizen_fail(400, 'Căn cứ đại diện không hợp lệ'); END IF;
  IF length(btrim(coalesce(p_represented_name, ''))) NOT BETWEEN 2 AND 120 THEN PERFORM public.citizen_fail(400, 'Họ tên người được đại diện từ 2 đến 120 ký tự'); END IF;
  IF length(btrim(coalesce(p_authorization_reference, ''))) > 120 THEN PERFORM public.citizen_fail(400, 'Số giấy ủy quyền tối đa 120 ký tự'); END IF;
  IF p_valid_until IS NULL OR p_valid_until < public.today_vietnam() THEN PERFORM public.citizen_fail(422, 'Ngày hết hạn không hợp lệ hoặc đã qua'); END IF;
  IF NOT EXISTS (SELECT 1 FROM procedures WHERE id = p_procedure_id AND published = true) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy thủ tục được công bố');
  END IF;
  INSERT INTO citizen_representations(citizen_id, tenant_id, represented_name, relationship, legal_basis, authorization_reference, procedure_id, valid_until)
  VALUES (a.citizen_id, a.tenant_id, btrim(p_represented_name), p_relationship, p_legal_basis, btrim(coalesce(p_authorization_reference, '')),
    p_procedure_id, p_valid_until)
  RETURNING id, status INTO v_row;
  INSERT INTO citizen_representation_audit(representation_id, citizen_id, tenant_id, action, application_id, actor_name)
  VALUES (v_row.id, a.citizen_id, a.tenant_id, 'requested', NULL, a.display_name);
  RETURN row_to_json(v_row);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_representation_audit(p_representation_id uuid) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM citizen_representations WHERE id = p_representation_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy quyền đại diện');
  END IF;
  RETURN coalesce((SELECT json_agg(x ORDER BY x.created_at DESC, x.id DESC) FROM (
    SELECT id, action, application_id, actor_name, created_at FROM citizen_representation_audit
    WHERE representation_id = p_representation_id ORDER BY created_at DESC, id DESC LIMIT 100) x), '[]'::json);
END $$;

-- Khóa tệp minh chứng để Kênh người dân đọc từ kho đối tượng (không trả cho trình duyệt).
CREATE OR REPLACE FUNCTION api.citizen_representation_evidence(p_representation_id uuid) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v json;
BEGIN
  SELECT json_build_object('evidence_key', evidence_key, 'evidence_type', evidence_type) INTO v
  FROM citizen_representations WHERE id = p_representation_id AND evidence_key IS NOT NULL AND evidence_type IS NOT NULL;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Chưa có minh chứng hoặc không có quyền xem'); END IF;
  RETURN v;
END $$;

-- Gắn tệp minh chứng mới (đã lưu vào kho) cho yêu cầu đang chờ xác minh; trả khóa tệp cũ để Kênh người dân xóa.
CREATE OR REPLACE FUNCTION api.citizen_representation_evidence_set(p_representation_id uuid, p_evidence_key text,
  p_evidence_name text, p_evidence_type text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_old text; v_found boolean;
BEGIN
  IF coalesce(p_evidence_key, '') !~ '^[0-9a-f-]{36}\.(pdf|png|jpg)$' OR p_evidence_type NOT IN ('application/pdf', 'image/png', 'image/jpeg') THEN
    PERFORM public.citizen_fail(400, 'Tệp minh chứng không hợp lệ');
  END IF;
  SELECT evidence_key, true INTO v_old, v_found FROM citizen_representations
  WHERE id = p_representation_id AND status = 'pending' FOR UPDATE;
  IF v_found IS NULL THEN
    PERFORM public.citizen_fail(403, 'Chỉ được bổ sung minh chứng cho yêu cầu đang chờ xác minh của chính bạn');
  END IF;
  UPDATE citizen_representations SET evidence_key = p_evidence_key, evidence_name = left(coalesce(p_evidence_name, 'minh-chung'), 160),
    evidence_type = p_evidence_type, updated_at = now() WHERE id = p_representation_id;
  INSERT INTO citizen_representation_audit(representation_id, citizen_id, tenant_id, action, application_id, actor_name)
  VALUES (p_representation_id, a.citizen_id, a.tenant_id, 'evidence_uploaded', NULL, a.display_name);
  RETURN json_build_object('old_key', v_old);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_representation_revoke(p_representation_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT coalesce(public.citizen_revoke_own_representation(p_representation_id), false) THEN
    PERFORM public.citizen_fail(404, 'Quyền đại diện không tồn tại hoặc đã thu hồi');
  END IF;
  RETURN json_build_object('revoked', true);
END $$;

-- ===== 2. Trang gia đình =====
CREATE OR REPLACE FUNCTION api.citizen_family() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object(
    'members', coalesce((SELECT json_agg(m ORDER BY m.represented_name, m.procedure_id) FROM (
      SELECT r.id, r.represented_name, r.relationship, r.procedure_id, p.title AS procedure_title, r.valid_until, r.verified_at, r.status
      FROM citizen_representations r JOIN procedures p ON p.id = r.procedure_id
      WHERE r.status = 'verified' AND r.valid_until >= CURRENT_DATE
      ORDER BY r.represented_name, r.procedure_id LIMIT 100) m), '[]'::json),
    'cases', coalesce((SELECT json_agg(c ORDER BY c.updated_at DESC) FROM (
      SELECT ap.id, ap.representation_id, ap.procedure_id, p.title AS procedure_title, ap.applicant_name, ap.status,
        ap.submitted_at, ap.updated_at, ap.due_at,
        (SELECT count(*)::int FROM application_documents d WHERE d.application_id = ap.id) AS document_count
      FROM applications ap JOIN procedures p ON p.id = ap.procedure_id
      WHERE ap.representation_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM citizen_representations r WHERE r.id = ap.representation_id AND r.status = 'verified'
          AND r.valid_until >= CURRENT_DATE AND r.procedure_id = ap.procedure_id)
      ORDER BY ap.updated_at DESC LIMIT 200) c), '[]'::json),
    'notice', 'Chỉ hiển thị hồ sơ do chính tài khoản này nộp theo quyền đại diện đã xác minh. Không truy cập hồ sơ riêng của người thân.');
END $$;

-- ===== 3. Nhóm thủ tục nộp cùng lúc =====
CREATE OR REPLACE FUNCTION api.citizen_service_batches() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object('items', coalesce((SELECT json_agg(b ORDER BY b.created_at DESC) FROM (
    SELECT b.id, b.title, b.purpose, b.workflow_mode, b.created_at, b.updated_at,
      count(i.procedure_id)::int AS procedure_count,
      count(i.application_id)::int AS created_count,
      count(i.application_id) FILTER (WHERE ap.status <> 'draft')::int AS submitted_count,
      count(i.application_id) FILTER (WHERE ap.status = 'completed')::int AS completed_count
    FROM citizen_service_batches b JOIN citizen_service_batch_items i ON i.batch_id = b.id
    LEFT JOIN applications ap ON ap.id = i.application_id
    GROUP BY b.id ORDER BY b.created_at DESC LIMIT 50) b), '[]'::json));
END $$;

-- p_phone đã được Kênh người dân kiểm tra (shared/identity-validation.ts) khi công dân đồng ý dùng chung.
CREATE OR REPLACE FUNCTION api.citizen_service_batch_create(p_title text, p_purpose text, p_procedure_ids text[],
  p_share_consent boolean DEFAULT false, p_phone text DEFAULT '') RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_id uuid; i int;
BEGIN
  PERFORM public.check_text(p_title, 'Tên nhóm thủ tục', 3, 120), public.check_text(p_purpose, 'Mục đích', 0, 500);
  IF coalesce(array_length(p_procedure_ids, 1), 0) NOT BETWEEN 2 AND 4 THEN
    PERFORM public.citizen_fail(400, 'Chọn từ 2 đến 4 thủ tục');
  END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_procedure_ids) x) <> array_length(p_procedure_ids, 1) THEN
    PERFORM public.citizen_fail(422, 'Một thủ tục không được chọn nhiều lần');
  END IF;
  IF (SELECT count(*) FROM procedures WHERE id = ANY (p_procedure_ids) AND published = true) <> array_length(p_procedure_ids, 1) THEN
    PERFORM public.citizen_fail(422, 'Có thủ tục không còn được công bố');
  END IF;
  INSERT INTO citizen_service_batches(citizen_id, tenant_id, title, purpose, shared_data, shared_consent)
  VALUES (a.citizen_id, a.tenant_id, btrim(p_title), btrim(coalesce(p_purpose, '')),
    CASE WHEN p_share_consent THEN jsonb_build_object('applicantName', a.display_name, 'phone', btrim(coalesce(p_phone, ''))) ELSE '{}'::jsonb END,
    coalesce(p_share_consent, false))
  RETURNING id INTO v_id;
  FOR i IN 1 .. array_length(p_procedure_ids, 1) LOOP
    INSERT INTO citizen_service_batch_items(batch_id, procedure_id, position) VALUES (v_id, p_procedure_ids[i], i);
  END LOOP;
  RETURN json_build_object('id', v_id, 'mode', 'preparation');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_service_batch(p_batch_id uuid) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v jsonb;
BEGIN
  SELECT to_jsonb(b) INTO v FROM (SELECT id, title, purpose, workflow_mode, shared_data, shared_consent, created_at, updated_at
    FROM citizen_service_batches WHERE id = p_batch_id) b;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy nhóm thủ tục thuộc tài khoản'); END IF;
  RETURN v || jsonb_build_object('items', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.position) FROM (
    SELECT it.procedure_id, p.title, p.category, p.summary, it.application_id, ap.status, ap.updated_at AS application_updated_at, it.position
    FROM citizen_service_batch_items it JOIN procedures p ON p.id = it.procedure_id
    LEFT JOIN applications ap ON ap.id = it.application_id WHERE it.batch_id = p_batch_id) i), '[]'::jsonb));
END $$;

-- ===== 4. Quyền gọi =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['api.citizen_representations()',
    'api.citizen_representation_create(text, text, text, text, text, date)', 'api.citizen_representation_audit(uuid)',
    'api.citizen_representation_evidence(uuid)', 'api.citizen_representation_evidence_set(uuid, text, text, text)',
    'api.citizen_representation_revoke(uuid)', 'api.citizen_family()', 'api.citizen_service_batches()',
    'api.citizen_service_batch_create(text, text, text[], boolean, text)', 'api.citizen_service_batch(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
