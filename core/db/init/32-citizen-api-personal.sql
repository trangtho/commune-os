-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API của lõi cho phần cá nhân hóa của Kênh người dân: quyền chia sẻ dữ liệu, nhật ký sử dụng dữ liệu cá nhân,
-- lưu trữ và đề nghị về dữ liệu, đồng bộ thông tin tự khai, tùy chọn cá nhân hóa, lộ trình sự kiện cuộc sống, nhắc việc,
-- sổ giao dịch, không gian làm việc, vị trí bước đang soạn và tín hiệu khó khăn ẩn danh.
-- Gọi qua cổng APISIX (POST /rest/rpc/<tên hàm>) bằng token Keycloak của công dân; SECURITY INVOKER, RLS theo công dân.
-- Phần diễn giải (gợi ý theo tình huống, bước tiếp theo, xuất CSV) vẫn ở Kênh người dân, dùng mã dùng chung shared/.
-- Chạy lại nhiều lần được.

-- ===== 1. Quyền chia sẻ dữ liệu, nhật ký sử dụng, lưu trữ, đề nghị về dữ liệu =====
CREATE OR REPLACE FUNCTION api.citizen_consents() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object(
    'items', coalesce((SELECT json_agg(x ORDER BY x.id) FROM (
      SELECT p.id, p.title, p.description, p.legal_basis, p.basis_explanation, p.categories, p.recipients, p.validity_days,
        e.decision, e.valid_until, e.decided_at, (e.decision = 'granted' AND e.valid_until > now()) AS active
      FROM citizen_processing_purposes p
      LEFT JOIN LATERAL (SELECT decision, valid_until, decided_at FROM citizen_consent_events
                         WHERE purpose_id = p.id ORDER BY id DESC LIMIT 1) e ON true
      WHERE p.published) x), '[]'::json),
    'history', coalesce((SELECT json_agg(h ORDER BY h.id DESC) FROM (
      SELECT e.id, e.purpose_id, p.title, e.decision, e.decided_at, e.valid_until
      FROM citizen_consent_events e JOIN citizen_processing_purposes p ON p.id = e.purpose_id
      ORDER BY e.id DESC LIMIT 50) h), '[]'::json));
END $$;

-- Chỉ mục đích có căn cứ "đồng ý" mới do công dân bật / tắt; khóa tư vấn để hai quyết định không chen nhau.
CREATE OR REPLACE FUNCTION api.citizen_consent_decide(p_purpose_id text, p_decision text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_days int;
BEGIN
  IF p_decision NOT IN ('granted', 'withdrawn') THEN PERFORM public.citizen_fail(400, 'Quyết định không hợp lệ'); END IF;
  SELECT validity_days INTO v_days FROM citizen_processing_purposes WHERE id = p_purpose_id AND published AND legal_basis = 'consent';
  IF NOT FOUND THEN PERFORM public.citizen_fail(403, 'Hoạt động này không cho phép quản lý bằng sự đồng ý'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(a.citizen_id::text || ':' || p_purpose_id));
  IF public.citizen_active_consent(p_purpose_id) = (p_decision = 'granted') THEN
    PERFORM public.citizen_fail(409, 'Trạng thái quyền chia sẻ đã được cập nhật');
  END IF;
  INSERT INTO citizen_consent_events(citizen_id, tenant_id, purpose_id, decision, valid_until)
  VALUES (a.citizen_id, a.tenant_id, p_purpose_id, p_decision,
    CASE WHEN p_decision = 'granted' THEN now() + v_days * interval '1 day' ELSE NULL END);
  PERFORM public.citizen_record_access(CASE WHEN p_decision = 'granted' THEN 'consent_granted' ELSE 'consent_withdrawn' END,
    'Quản lý quyền sử dụng dữ liệu', 'consent', p_purpose_id);
  RETURN json_build_object('ok', true, 'decision', p_decision,
    'notice', 'Rút quyền không thu hồi được các hồ sơ đã nộp hoặc bản sao đã chia sẻ trước đó.');
END $$;

-- Nhật ký sử dụng dữ liệu cá nhân và kiểm tra toàn bộ chuỗi mã băm (không chỉ 200 dòng hiển thị).
CREATE OR REPLACE FUNCTION api.citizen_data_access() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v record;
BEGIN
  WITH history AS (
    SELECT seq_no, previous_hash, event_hash, coalesce(lag(event_hash) OVER (ORDER BY seq_no), '') AS prior,
      citizen_id, tenant_id, action, purpose, processing_unit, resource_kind, resource_reference, actor_kind, occurred_at
    FROM citizen_data_access_events)
  SELECT count(*)::int AS events,
    count(*) FILTER (WHERE previous_hash <> prior OR event_hash <> public.citizen_data_event_digest(citizen_id, tenant_id, action,
      purpose, processing_unit, resource_kind, resource_reference, actor_kind, occurred_at, previous_hash))::int AS mismatches
  INTO v FROM history;
  RETURN json_build_object(
    'items', coalesce((SELECT json_agg(e ORDER BY e.seq_no DESC) FROM (
      SELECT id, seq_no, action, purpose, processing_unit, resource_kind, resource_reference, actor_kind, occurred_at,
        previous_hash, event_hash FROM citizen_data_access_events ORDER BY seq_no DESC LIMIT 200) e), '[]'::json),
    'integrity', json_build_object('checked', coalesce(v.events, 0), 'ok', coalesce(v.mismatches, 0) = 0),
    'coverage', 'Chỉ các sự kiện đã tích hợp vào Cổng công dân; không phải mọi truy cập tại hệ thống bên ngoài.');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_retention() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object(
    'policies', coalesce((SELECT json_agg(p ORDER BY p.id) FROM (
      SELECT id, resource_kind, title, description, retention_days, legal_reference, approved, automatic_action
      FROM citizen_retention_policies) p), '[]'::json),
    'reviews', coalesce((SELECT json_agg(r ORDER BY r.found_at DESC) FROM (
      SELECT r.id, r.policy_id, p.title, r.resource_kind, r.resource_reference, r.state, r.found_at, r.decided_at, r.decision_note
      FROM citizen_retention_reviews r JOIN citizen_retention_policies p ON p.id = r.policy_id
      ORDER BY r.found_at DESC LIMIT 100) r), '[]'::json),
    'requests', coalesce((SELECT json_agg(q ORDER BY q.created_at DESC) FROM (
      SELECT id, request_type, details, state, created_at, processed_at, resolution_note
      FROM citizen_data_rights_requests ORDER BY created_at DESC LIMIT 50) q), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_privacy_request_create(p_request_type text, p_details text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_row record;
BEGIN
  IF p_request_type NOT IN ('access', 'correct', 'restrict', 'erase', 'retention_review') THEN
    PERFORM public.citizen_fail(400, 'Loại đề nghị không hợp lệ');
  END IF;
  PERFORM public.check_text(p_details, 'Nội dung', 10, 2000);
  INSERT INTO citizen_data_rights_requests(citizen_id, tenant_id, request_type, details)
  VALUES (a.citizen_id, a.tenant_id, p_request_type, btrim(p_details)) RETURNING id, state, created_at INTO v_row;
  PERFORM public.citizen_record_access('privacy_request_created', 'Tiếp nhận đề nghị về dữ liệu cá nhân', 'privacy_request', v_row.id::text);
  RETURN row_to_json(v_row);
END $$;

-- ===== 2. Đồng bộ thông tin tự khai sang địa phương khác (lãnh đạo xã nhận xem xét thủ công) =====
CREATE OR REPLACE FUNCTION api.citizen_sync() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object(
    'localities', coalesce((SELECT json_agg(t ORDER BY t.name) FROM (SELECT id, name, code FROM tenants WHERE id <> a.tenant_id) t), '[]'::json),
    'requests', coalesce((SELECT json_agg(r ORDER BY r.created_at DESC) FROM (
      SELECT r.id, r.state, r.provenance, r.created_at, r.reviewed_at, r.review_note, t.name AS target_name
      FROM citizen_sync_requests r JOIN tenants t ON t.id = r.target_tenant_id ORDER BY r.created_at DESC LIMIT 40) r), '[]'::json),
    'notice', 'Yêu cầu trao đổi dữ liệu liên địa phương được kiểm tra thủ công; chưa tự động đồng bộ hồ sơ hay ghi đè dữ liệu đã xác minh.');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_sync_create(p_target_tenant_id uuid, p_categories text[]) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); c record; v_payload jsonb := '{}'; k text; v_row record;
BEGIN
  IF coalesce(array_length(p_categories, 1), 0) NOT BETWEEN 1 AND 3
     OR EXISTS (SELECT 1 FROM unnest(p_categories) x WHERE x NOT IN ('display_name', 'phone', 'address')) THEN
    PERFORM public.citizen_fail(400, 'Loại thông tin không hợp lệ');
  END IF;
  IF p_target_tenant_id = a.tenant_id THEN PERFORM public.citizen_fail(400, 'Địa phương nhận phải khác địa phương hiện tại'); END IF;
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_target_tenant_id) THEN
    PERFORM public.citizen_fail(400, 'Địa phương nhận không được hỗ trợ');
  END IF;
  SELECT display_name, phone, address INTO c FROM citizens WHERE id = a.citizen_id;
  FOREACH k IN ARRAY p_categories LOOP
    v_payload := v_payload || jsonb_build_object(k, coalesce(CASE k WHEN 'display_name' THEN c.display_name
      WHEN 'phone' THEN c.phone ELSE c.address END, ''));
  END LOOP;
  INSERT INTO citizen_sync_requests(citizen_id, source_tenant_id, target_tenant_id, payload)
  VALUES (a.citizen_id, a.tenant_id, p_target_tenant_id, v_payload) RETURNING id, state, created_at INTO v_row;
  PERFORM public.citizen_record_access('share_case', 'Yêu cầu chuyển dữ liệu tự khai sang địa phương khác', 'sync_request', v_row.id::text);
  RETURN json_build_object('id', v_row.id, 'state', v_row.state, 'created_at', v_row.created_at,
    'notice', 'Đã tạo yêu cầu đồng bộ có xác nhận. Đơn vị nhận chỉ có thể xem qua API được cấp quyền; không tự ghi đè.');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_sync_cancel(p_request_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  UPDATE citizen_sync_requests SET state = 'cancelled' WHERE id = p_request_id AND state = 'pending';
  IF NOT FOUND THEN PERFORM public.citizen_fail(404, 'Không tìm thấy yêu cầu còn chờ xử lý'); END IF;
  RETURN json_build_object('id', p_request_id, 'state', 'cancelled');
END $$;

-- ===== 3. Tùy chọn cá nhân hóa =====
CREATE OR REPLACE FUNCTION public.citizen_preferences_json(p_citizen uuid) RETURNS json
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce((SELECT json_build_object('personalization_enabled', personalization_enabled, 'audience_group', audience_group,
      'interest_categories', coalesce(to_json(interest_categories), '[]'::json), 'residence_tenant_id', residence_tenant_id,
      'temporary_tenant_id', temporary_tenant_id, 'preferred_tenant_id', preferred_tenant_id, 'locality_source', locality_source,
      'locality_verified_at', locality_verified_at)
    FROM citizen_service_preferences WHERE citizen_id = p_citizen),
    json_build_object('personalization_enabled', false, 'audience_group', 'general', 'interest_categories', '[]'::json,
      'residence_tenant_id', NULL, 'temporary_tenant_id', NULL, 'preferred_tenant_id', NULL, 'locality_source', NULL,
      'locality_verified_at', NULL))
$$;

CREATE OR REPLACE FUNCTION api.citizen_preferences() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN public.citizen_preferences_json(a.citizen_id);
END $$;

-- Địa phương đã xác minh qua nguồn định danh chỉ giữ nhãn "đã xác minh" khi công dân không đổi địa phương.
CREATE OR REPLACE FUNCTION api.citizen_preferences_save(p_personalization_enabled boolean, p_audience_group text,
  p_interest_categories text[], p_residence_tenant_id uuid, p_temporary_tenant_id uuid, p_preferred_tenant_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); e record; v_localities uuid[]; v_unchanged boolean;
BEGIN
  IF p_audience_group NOT IN ('general', 'parent', 'business', 'resident', 'other') THEN PERFORM public.citizen_fail(400, 'Nhóm đối tượng không hợp lệ'); END IF;
  v_localities := array_remove(ARRAY[p_residence_tenant_id, p_temporary_tenant_id, p_preferred_tenant_id], NULL);
  IF (SELECT count(*) FROM tenants WHERE id = ANY (v_localities)) <> (SELECT count(DISTINCT x) FROM unnest(v_localities) x) THEN
    PERFORM public.citizen_fail(422, 'Địa phương không có trong danh mục hệ thống');
  END IF;
  IF coalesce(array_length(p_interest_categories, 1), 0) > 8
     OR (SELECT count(DISTINCT x) FROM unnest(p_interest_categories) x) <> coalesce(array_length(p_interest_categories, 1), 0)
     OR EXISTS (SELECT 1 FROM unnest(p_interest_categories) x WHERE NOT EXISTS (SELECT 1 FROM procedures WHERE published AND category = x)) THEN
    PERFORM public.citizen_fail(422, 'Lĩnh vực quan tâm không hợp lệ');
  END IF;
  SELECT locality_source, locality_verified_at, residence_tenant_id, temporary_tenant_id INTO e
  FROM citizen_service_preferences WHERE citizen_id = a.citizen_id;
  v_unchanged := e.locality_source = 'oidc_verified' AND e.residence_tenant_id IS NOT DISTINCT FROM p_residence_tenant_id
    AND e.temporary_tenant_id IS NOT DISTINCT FROM p_temporary_tenant_id;
  INSERT INTO citizen_service_preferences(citizen_id, tenant_id, personalization_enabled, audience_group, interest_categories,
    residence_tenant_id, temporary_tenant_id, preferred_tenant_id, locality_source, locality_verified_at)
  VALUES (a.citizen_id, a.tenant_id, coalesce(p_personalization_enabled, false), p_audience_group, coalesce(p_interest_categories, '{}'),
    p_residence_tenant_id, p_temporary_tenant_id, p_preferred_tenant_id,
    CASE WHEN v_unchanged THEN 'oidc_verified' ELSE 'self_declared' END, CASE WHEN v_unchanged THEN e.locality_verified_at END)
  ON CONFLICT (citizen_id) DO UPDATE SET personalization_enabled = EXCLUDED.personalization_enabled,
    audience_group = EXCLUDED.audience_group, interest_categories = EXCLUDED.interest_categories,
    residence_tenant_id = EXCLUDED.residence_tenant_id, temporary_tenant_id = EXCLUDED.temporary_tenant_id,
    preferred_tenant_id = EXCLUDED.preferred_tenant_id, locality_source = EXCLUDED.locality_source,
    locality_verified_at = EXCLUDED.locality_verified_at, updated_at = now();
  RETURN public.citizen_preferences_json(a.citizen_id);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_preferences_delete() RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  DELETE FROM citizen_service_preferences WHERE citizen_id = a.citizen_id;
  RETURN json_build_object('ok', true);
END $$;

-- ===== 4. Lộ trình sự kiện cuộc sống =====
CREATE OR REPLACE FUNCTION api.citizen_journeys() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object('items', coalesce((SELECT json_agg(j ORDER BY j.updated_at DESC) FROM (
    SELECT j.id, j.title, j.event_code, j.status, j.created_at, j.updated_at, count(i.id)::int AS step_count,
      count(i.id) FILTER (WHERE coalesce(ap.status, '') = 'completed' OR (i.application_id IS NULL AND i.state = 'done'))::int AS done_count
    FROM citizen_life_journeys j LEFT JOIN citizen_life_journey_items i ON i.journey_id = j.id
    LEFT JOIN applications ap ON ap.id = i.application_id
    GROUP BY j.id ORDER BY j.updated_at DESC LIMIT 50) j), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_journey_create(p_title text, p_situation text, p_event_code text, p_procedure_ids text[]) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_id uuid; i int;
BEGIN
  PERFORM public.check_text(p_title, 'Tên lộ trình', 3, 120), public.check_text(p_situation, 'Tình huống', 0, 500);
  IF p_event_code NOT IN ('birth', 'marriage', 'residence', 'business', 'loss', 'other') THEN PERFORM public.citizen_fail(400, 'Loại sự kiện không hợp lệ'); END IF;
  IF coalesce(array_length(p_procedure_ids, 1), 0) NOT BETWEEN 1 AND 6 THEN PERFORM public.citizen_fail(400, 'Chọn từ 1 đến 6 thủ tục'); END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_procedure_ids) x) <> array_length(p_procedure_ids, 1) THEN
    PERFORM public.citizen_fail(422, 'Một thủ tục không thể xuất hiện hai lần');
  END IF;
  IF (SELECT count(*) FROM procedures p WHERE p.published AND p.id = ANY (p_procedure_ids)
        AND public.procedure_enabled_for(a.tenant_id, p.id)) <> array_length(p_procedure_ids, 1) THEN
    PERFORM public.citizen_fail(422, 'Có thủ tục chưa mở tại xã của bạn hoặc không còn công bố');
  END IF;
  INSERT INTO citizen_life_journeys(citizen_id, tenant_id, title, situation, event_code)
  VALUES (a.citizen_id, a.tenant_id, btrim(p_title), btrim(coalesce(p_situation, '')), p_event_code) RETURNING id INTO v_id;
  FOR i IN 1 .. array_length(p_procedure_ids, 1) LOOP
    INSERT INTO citizen_life_journey_items(journey_id, citizen_id, tenant_id, procedure_id, position)
    VALUES (v_id, a.citizen_id, a.tenant_id, p_procedure_ids[i], i);
  END LOOP;
  RETURN json_build_object('id', v_id, 'notice', 'Đã lưu lộ trình chuẩn bị. Chưa tạo hoặc nộp bất kỳ hồ sơ nào.');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_journey(p_journey_id uuid) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v jsonb;
BEGIN
  SELECT to_jsonb(j) INTO v FROM citizen_life_journeys j WHERE j.id = p_journey_id;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy lộ trình'); END IF;
  RETURN v || jsonb_build_object('items', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.position) FROM (
    SELECT i.id, i.procedure_id, i.position, i.state, i.application_id, i.updated_at, p.title, p.summary, p.fee_note, p.sla_days,
      ap.status AS application_status, ap.updated_at AS application_updated_at, v.provenance_status, v.source_url,
      coalesce((SELECT jsonb_agg(jsonb_build_object('code', d.document_code, 'name', d.document_name, 'required', d.is_required)
        ORDER BY d.document_code) FROM procedure_documents d WHERE d.procedure_id = i.procedure_id), '[]'::jsonb) AS documents
    FROM citizen_life_journey_items i JOIN procedures p ON p.id = i.procedure_id
    LEFT JOIN applications ap ON ap.id = i.application_id
    LEFT JOIN LATERAL (SELECT provenance_status, source_url FROM citizen_procedure_versions WHERE procedure_id = i.procedure_id
                       ORDER BY version_no DESC LIMIT 1) v ON true
    WHERE i.journey_id = p_journey_id) x), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_journey_status(p_journey_id uuid, p_status text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF p_status NOT IN ('active', 'completed', 'archived') THEN PERFORM public.citizen_fail(400, 'Trạng thái không hợp lệ'); END IF;
  UPDATE citizen_life_journeys SET status = p_status, updated_at = now() WHERE id = p_journey_id;
  IF NOT FOUND THEN PERFORM public.citizen_fail(404, 'Không tìm thấy lộ trình'); END IF;
  RETURN json_build_object('id', p_journey_id, 'status', p_status);
END $$;

-- p_link = true thì đặt (hoặc bỏ, khi p_application_id rỗng) hồ sơ gắn với bước; false thì giữ nguyên.
CREATE OR REPLACE FUNCTION api.citizen_journey_item_update(p_journey_id uuid, p_item_id uuid, p_state text,
  p_link boolean DEFAULT false, p_application_id text DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); it record; v_app text;
BEGIN
  IF p_state NOT IN ('todo', 'in_progress', 'done', 'skipped') THEN PERFORM public.citizen_fail(400, 'Trạng thái không hợp lệ'); END IF;
  SELECT i.id, i.procedure_id, i.application_id, j.status AS journey_status INTO it
  FROM citizen_life_journey_items i JOIN citizen_life_journeys j ON j.id = i.journey_id
  WHERE i.id = p_item_id AND i.journey_id = p_journey_id FOR UPDATE OF i;
  IF it.id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy bước thuộc lộ trình'); END IF;
  IF it.journey_status <> 'active' THEN PERFORM public.citizen_fail(409, 'Lộ trình đã đóng'); END IF;
  v_app := it.application_id;
  IF p_link THEN
    IF nullif(p_application_id, '') IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM applications WHERE id = p_application_id AND procedure_id = it.procedure_id) THEN
      PERFORM public.citizen_fail(422, 'Chỉ liên kết hồ sơ đúng thủ tục của chính tài khoản');
    END IF;
    v_app := nullif(p_application_id, '');
  END IF;
  UPDATE citizen_life_journey_items SET state = p_state, application_id = v_app, updated_at = now() WHERE id = p_item_id;
  UPDATE citizen_life_journeys SET updated_at = now() WHERE id = p_journey_id;
  RETURN json_build_object('id', p_item_id, 'state', p_state, 'applicationId', v_app,
    'notice', 'Trạng thái tự theo dõi; không phải kết luận hoàn thành từ cơ quan.');
END $$;

-- Dữ liệu để gợi ý thủ tục theo tình huống công dân đã tự lưu (không theo dõi ngầm dữ liệu cá nhân).
CREATE OR REPLACE FUNCTION api.citizen_life_suggestion_sources() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object(
    'plans', coalesce((SELECT json_agg(x ORDER BY x.updated_at DESC) FROM (
      SELECT j.id, j.title, j.situation, j.event_code, j.updated_at, array_remove(array_agg(i.procedure_id), NULL) AS selected_ids
      FROM citizen_life_journeys j LEFT JOIN citizen_life_journey_items i ON i.journey_id = j.id
      WHERE j.status = 'active' AND j.situation <> '' GROUP BY j.id ORDER BY j.updated_at DESC LIMIT 8) x), '[]'::json),
    'catalog', coalesce((SELECT json_agg(p ORDER BY p.title) FROM (
      SELECT id, title, summary, category FROM procedures
      WHERE published = true AND public.procedure_enabled_for(a.tenant_id, id) ORDER BY title LIMIT 300) p), '[]'::json));
END $$;

-- ===== 5. Nhắc việc =====
CREATE OR REPLACE FUNCTION api.citizen_reminders() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object(
    'settings', coalesce((SELECT json_build_object('enabled', enabled, 'days_before', days_before)
                          FROM citizen_reminder_settings WHERE citizen_id = a.citizen_id), json_build_object('enabled', false, 'days_before', 2)),
    'tasks', coalesce((SELECT json_agg(t ORDER BY t.due_on) FROM (
      SELECT id, title, due_on, completed_at, application_id FROM citizen_personal_tasks ORDER BY due_on LIMIT 100) t), '[]'::json),
    'cases', coalesce((SELECT json_agg(c ORDER BY c.due_at) FROM (
      SELECT id, procedure_id, status, due_at FROM applications
      WHERE status IN ('submitted', 'processing', 'supplement') AND due_at IS NOT NULL ORDER BY due_at LIMIT 50) c), '[]'::json),
    'bookings', coalesce((SELECT json_agg(b ORDER BY b.starts_at) FROM (
      SELECT b.id, b.status, s.starts_at, p.title FROM citizen_counter_bookings b JOIN citizen_counter_slots s ON s.id = b.slot_id
      JOIN procedures p ON p.id = b.procedure_id WHERE b.status = 'booked' AND s.starts_at >= now() ORDER BY s.starts_at LIMIT 40) b), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_reminder_create(p_title text, p_due_on date, p_application_id text DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_row record;
BEGIN
  PERFORM public.check_text(p_title, 'Tên công việc', 3, 140);
  IF p_due_on IS NULL OR p_due_on < DATE '2000-01-01' OR p_due_on > DATE '2100-12-31' THEN PERFORM public.citizen_fail(422, 'Ngày nhắc không hợp lệ'); END IF;
  IF nullif(p_application_id, '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ của bạn');
  END IF;
  INSERT INTO citizen_personal_tasks(citizen_id, tenant_id, title, due_on, application_id)
  VALUES (a.citizen_id, a.tenant_id, btrim(p_title), p_due_on, nullif(p_application_id, '')) RETURNING id, title, due_on INTO v_row;
  RETURN row_to_json(v_row);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_reminder_complete(p_task_id uuid, p_completed boolean) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_row record;
BEGIN
  UPDATE citizen_personal_tasks SET completed_at = CASE WHEN p_completed THEN now() END WHERE id = p_task_id
  RETURNING id, completed_at INTO v_row;
  IF v_row.id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy công việc'); END IF;
  RETURN row_to_json(v_row);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_reminder_settings_save(p_enabled boolean, p_days_before integer) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF p_enabled IS NULL OR p_days_before IS NULL OR p_days_before NOT BETWEEN 0 AND 14 THEN
    PERFORM public.citizen_fail(400, 'Số ngày nhắc trước từ 0 đến 14');
  END IF;
  INSERT INTO citizen_reminder_settings(citizen_id, tenant_id, enabled, days_before)
  VALUES (a.citizen_id, a.tenant_id, p_enabled, p_days_before)
  ON CONFLICT (citizen_id) DO UPDATE SET enabled = EXCLUDED.enabled, days_before = EXCLUDED.days_before, updated_at = now();
  RETURN json_build_object('enabled', p_enabled, 'daysBefore', p_days_before, 'channel', 'in_app_only');
END $$;

-- ===== 6. Sổ giao dịch, không gian làm việc, vị trí bước đang soạn, tín hiệu khó khăn =====
CREATE OR REPLACE FUNCTION api.citizen_transactions(p_status text DEFAULT 'all', p_q text DEFAULT '') RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
  v_status text := CASE WHEN p_status IN ('all','draft','submitted','processing','supplement','completed','rejected') THEN p_status ELSE 'all' END;
  v_q text := left(btrim(coalesce(p_q, '')), 90); v json;
BEGIN
  SELECT coalesce(json_agg(r ORDER BY r.updated_at DESC), '[]'::json) INTO v FROM (
    SELECT ap.id, ap.status, p.title AS procedure_title, ap.submitted_at, ap.updated_at,
      coalesce(json_agg(json_build_object('id', e.id, 'eventType', e.event_type, 'note', e.note, 'at', e.created_at, 'actor', e.actor_name)
        ORDER BY e.created_at, e.id) FILTER (WHERE e.id IS NOT NULL), '[]'::json) AS events
    FROM applications ap JOIN procedures p ON p.id = ap.procedure_id
    LEFT JOIN application_events e ON e.application_id = ap.id
    WHERE (v_status = 'all' OR ap.status = v_status)
      AND (v_q = '' OR ap.id ILIKE '%' || v_q || '%' OR p.title ILIKE '%' || v_q || '%')
    GROUP BY ap.id, p.id ORDER BY ap.updated_at DESC LIMIT 100) r;
  PERFORM public.citizen_record_access('view_case', 'Xem sổ giao dịch hành chính', 'administrative_ledger', 'self');
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.citizen_workspace() RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v json;
BEGIN
  v := json_build_object(
    'cases', coalesce((SELECT json_agg(c ORDER BY c.updated_at DESC) FROM (
      SELECT ap.id, ap.procedure_id, p.title AS procedure_title, ap.status, ap.updated_at, ap.due_at
      FROM applications ap JOIN procedures p ON p.id = ap.procedure_id ORDER BY ap.updated_at DESC LIMIT 50) c), '[]'::json),
    'plans', coalesce((SELECT json_agg(j ORDER BY j.updated_at DESC) FROM (
      SELECT j.id, j.title, j.event_code, j.status, j.updated_at, count(i.id)::int AS steps
      FROM citizen_life_journeys j LEFT JOIN citizen_life_journey_items i ON j.id = i.journey_id
      GROUP BY j.id ORDER BY j.updated_at DESC LIMIT 12) j), '[]'::json),
    'vaultCount', (SELECT count(*)::int FROM citizen_vault_documents WHERE archived_at IS NULL),
    'unreadAlerts', coalesce((SELECT json_agg(n ORDER BY n.created_at DESC) FROM (
      SELECT id, title, created_at FROM citizen_notifications WHERE NOT is_read ORDER BY created_at DESC LIMIT 8) n), '[]'::json),
    'tasks', coalesce((SELECT json_agg(t ORDER BY t.due_on) FROM (
      SELECT id, title, due_on, completed_at, application_id FROM citizen_personal_tasks
      WHERE completed_at IS NULL ORDER BY due_on LIMIT 30) t), '[]'::json),
    'bookings', coalesce((SELECT json_agg(b ORDER BY b.starts_at) FROM (
      SELECT b.id, s.starts_at, p.title FROM citizen_counter_bookings b JOIN citizen_counter_slots s ON s.id = b.slot_id
      JOIN procedures p ON p.id = b.procedure_id WHERE s.starts_at >= now() ORDER BY s.starts_at LIMIT 8) b), '[]'::json));
  PERFORM public.citizen_record_access('view_case', 'Tổng hợp không gian quản lý hành chính cá nhân', 'workspace', 'self');
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.citizen_draft_cursor(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record;
BEGIN
  SELECT ap.id, ap.status, c.step, c.revision, c.updated_at INTO r FROM applications ap
  LEFT JOIN citizen_draft_cursors c ON c.application_id = ap.id WHERE ap.id = p_application_id;
  IF r.id IS NULL OR r.status <> 'draft' THEN PERFORM public.citizen_fail(404, 'Bản nháp không còn khả dụng'); END IF;
  RETURN json_build_object('applicationId', p_application_id, 'step', coalesce(r.step, 1), 'revision', coalesce(r.revision, 0),
    'updatedAt', r.updated_at, 'notice', 'Chỉ lưu bước thực hiện. Nội dung kê khai lưu trong bản nháp trên máy chủ.');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_draft_cursor_save(p_application_id text, p_step integer) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_row record;
BEGIN
  IF p_step IS NULL OR p_step NOT BETWEEN 1 AND 3 THEN PERFORM public.citizen_fail(400, 'Bước không hợp lệ'); END IF;
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id AND status = 'draft') THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy bản nháp của bạn');
  END IF;
  INSERT INTO citizen_draft_cursors(application_id, citizen_id, tenant_id, step) VALUES (p_application_id, a.citizen_id, a.tenant_id, p_step)
  ON CONFLICT (application_id) DO UPDATE SET step = EXCLUDED.step, updated_at = now() RETURNING step, revision, updated_at INTO v_row;
  RETURN row_to_json(v_row);
END $$;

-- Chỉ ghi mã loại khó khăn và bước thao tác; không lưu nội dung biểu mẫu, danh tính hay địa chỉ IP.
CREATE OR REPLACE FUNCTION api.citizen_friction_signal(p_procedure_id text, p_stage text, p_issue text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF p_stage NOT IN ('lookup', 'form', 'documents', 'review', 'chat')
     OR p_issue NOT IN ('needs_help', 'unclear_field', 'validation_problem', 'abandoned', 'insufficient_answer') THEN
    PERFORM public.citizen_fail(400, 'Tín hiệu không hợp lệ');
  END IF;
  IF p_procedure_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM procedures WHERE id = p_procedure_id AND published = true) THEN
    PERFORM public.citizen_fail(422, 'Thủ tục không tồn tại');
  END IF;
  INSERT INTO citizen_friction_events(tenant_id, procedure_id, stage, issue) VALUES (a.tenant_id, p_procedure_id, p_stage, p_issue);
  RETURN json_build_object('accepted', true,
    'notice', 'Chỉ ghi nhận mã loại khó khăn và bước thao tác; không lưu nội dung biểu mẫu hoặc danh tính.');
END $$;

-- ===== 7. Quyền gọi =====
DO $$
DECLARE f text;
BEGIN
  REVOKE ALL ON FUNCTION public.citizen_preferences_json(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.citizen_preferences_json(uuid) TO "citizen-app";
  FOREACH f IN ARRAY ARRAY['api.citizen_consents()', 'api.citizen_consent_decide(text, text)', 'api.citizen_data_access()',
    'api.citizen_retention()', 'api.citizen_privacy_request_create(text, text)', 'api.citizen_sync()',
    'api.citizen_sync_create(uuid, text[])', 'api.citizen_sync_cancel(uuid)', 'api.citizen_preferences()',
    'api.citizen_preferences_save(boolean, text, text[], uuid, uuid, uuid)', 'api.citizen_preferences_delete()',
    'api.citizen_journeys()', 'api.citizen_journey_create(text, text, text, text[])', 'api.citizen_journey(uuid)',
    'api.citizen_journey_status(uuid, text)', 'api.citizen_journey_item_update(uuid, uuid, text, boolean, text)',
    'api.citizen_life_suggestion_sources()', 'api.citizen_reminders()', 'api.citizen_reminder_create(text, date, text)',
    'api.citizen_reminder_complete(uuid, boolean)', 'api.citizen_reminder_settings_save(boolean, integer)',
    'api.citizen_transactions(text, text)', 'api.citizen_workspace()', 'api.citizen_draft_cursor(text)',
    'api.citizen_draft_cursor_save(text, integer)', 'api.citizen_friction_signal(text, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
