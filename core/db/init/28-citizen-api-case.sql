-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API của lõi cho trang chi tiết hồ sơ của Kênh người dân: bổ sung theo yêu cầu, hạn giải quyết, công đoạn,
-- lộ trình, nhận kết quả, mã chuyển hồ sơ tại quầy, đề nghị điều chỉnh / chuyển cơ quan, đánh giá, kiểm tra
-- trước khi nộp, cập nhật phiên bản thủ tục, tạo lại hồ sơ, mã kiểm chứng kết quả, dữ liệu cho trợ lý hồ sơ.
-- Gọi qua cổng APISIX (POST /rest/rpc/<tên hàm>) bằng token Keycloak của công dân (client citizen-app).
-- Cách làm như 21-citizen-api-core-flow.sql và 27-citizen-api-vault.sql: SECURITY INVOKER, RLS theo công dân do
-- rest_pre_request() đặt; mỗi giao dịch của API cũ trong ứng dụng là một hàm. Phần tính toán không cần dữ liệu khác
-- (diễn giải trạng thái, gợi ý bước tiếp, kiểm tra biểu mẫu) vẫn ở Kênh người dân, dùng chung mã shared/.
-- Lỗi nghiệp vụ dùng mã PTxyz qua public.citizen_fail(). Chạy lại nhiều lần được.

-- ===== 1. Trợ lý hồ sơ, gợi ý, lộ trình (dữ liệu để Kênh người dân diễn giải) =====
CREATE OR REPLACE FUNCTION api.citizen_case_facts(p_application_id text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v json;
BEGIN
  SELECT json_build_object('id', ap.id, 'status', ap.status, 'due_at', ap.due_at, 'result_note', ap.result_note,
    'procedure_id', ap.procedure_id, 'title', p.title,
    'events', coalesce((SELECT json_agg(e ORDER BY e.created_at DESC) FROM (
       SELECT event_type, note, created_at FROM application_events WHERE application_id = ap.id
       ORDER BY created_at DESC, id DESC LIMIT 6) e), '[]'::json))
  INTO v FROM applications ap JOIN procedures p ON p.id = ap.procedure_id WHERE ap.id = p_application_id;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Không thể truy cập hồ sơ này'); END IF;
  PERFORM public.citizen_record_access('view_case', 'Trả lời câu hỏi về hồ sơ cá nhân', 'application', p_application_id);
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION api.citizen_case_insight_facts(p_application_id text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record; v_stats json;
BEGIN
  SELECT id, status, procedure_id, form_data, due_at INTO r FROM applications WHERE id = p_application_id;
  IF r.id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ của bạn'); END IF;
  SELECT row_to_json(s) INTO v_stats FROM public.citizen_forecast_days(r.procedure_id, a.tenant_id) s;
  PERFORM public.citizen_record_access('view_case', 'Gợi ý bước tiếp theo và cảnh báo hồ sơ', 'application', p_application_id);
  RETURN json_build_object('application', row_to_json(r), 'statistics', v_stats,
    'observations', coalesce((SELECT json_agg(o ORDER BY o.confirmed_at DESC) FROM (
       SELECT ob.fields, d.original_name AS source, ob.confirmed_at FROM citizen_document_observations ob
       JOIN application_documents d ON d.id = ob.document_id
       WHERE ob.application_id = p_application_id ORDER BY ob.confirmed_at DESC LIMIT 30) o), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_case_roadmap(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record; v_latest uuid;
BEGIN
  SELECT id, procedure_id, status, due_at, updated_at, acknowledged_procedure_version_id INTO r
  FROM applications WHERE id = p_application_id;
  IF r.id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  SELECT id INTO v_latest FROM citizen_procedure_versions WHERE procedure_id = r.procedure_id ORDER BY version_no DESC LIMIT 1;
  RETURN json_build_object(
    'application', json_build_object('id', r.id, 'procedure_id', r.procedure_id, 'status', r.status, 'due_at', r.due_at, 'updated_at', r.updated_at),
    'needs_version_ack', r.status = 'draft' AND v_latest IS NOT NULL AND v_latest IS DISTINCT FROM r.acknowledged_procedure_version_id,
    'unresolved_supplements', (SELECT count(*) FROM citizen_supplement_items WHERE application_id = p_application_id AND responded_at IS NULL),
    'events', coalesce((SELECT json_agg(e ORDER BY e.created_at DESC) FROM (
       SELECT application_id, event_type, note, created_at FROM application_events WHERE application_id = p_application_id
       ORDER BY created_at DESC LIMIT 15) e), '[]'::json),
    'stages', coalesce((SELECT json_agg(s ORDER BY s.created_at DESC) FROM (
       SELECT stage_name, unit_name, stage_status, reason, created_at FROM citizen_case_stage_updates
       WHERE application_id = p_application_id ORDER BY created_at DESC LIMIT 15) s), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_case_stages(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ');
  END IF;
  SELECT coalesce(json_agg(u ORDER BY u.created_at, u.id), '[]'::json) INTO v FROM (
    SELECT id, stage_name, unit_name, stage_status, due_at, reason, staff_name, created_at FROM citizen_case_stage_updates
    WHERE application_id = p_application_id ORDER BY created_at DESC, id DESC LIMIT 200) u;
  RETURN json_build_object('items', v, 'officialStagesAvailable', json_array_length(v) > 0);
END $$;

-- ===== 2. Hạn giải quyết (tạo cảnh báo gần / quá hạn một lần cho mỗi mức) =====
CREATE OR REPLACE FUNCTION api.citizen_case_deadline(p_application_id text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record; v_level text; v_reason json;
BEGIN
  SELECT id, status, due_at, CASE WHEN due_at IS NULL THEN NULL ELSE (due_at - CURRENT_DATE)::int END AS days_left
  INTO r FROM applications WHERE id = p_application_id;
  IF r.id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  v_level := CASE WHEN r.status IN ('submitted', 'processing', 'supplement') AND r.days_left IS NOT NULL AND r.days_left <= 2
                  THEN CASE WHEN r.days_left < 0 THEN 'overdue' ELSE 'approaching' END ELSE 'none' END;
  IF v_level <> 'none' THEN
    INSERT INTO citizen_deadline_alerts(application_id, citizen_id, tenant_id, alert_level)
    VALUES (p_application_id, a.citizen_id, a.tenant_id, v_level) ON CONFLICT (application_id, alert_level) DO NOTHING;
    IF FOUND THEN
      INSERT INTO citizen_notifications(citizen_id, tenant_id, application_id, title, body)
      VALUES (a.citizen_id, a.tenant_id, p_application_id,
        CASE WHEN v_level = 'overdue' THEN 'Hồ sơ đã quá hạn giải quyết' ELSE 'Hồ sơ gần đến hạn giải quyết' END,
        CASE WHEN v_level = 'overdue' THEN 'Hồ sơ quá hạn; bạn có thể gửi yêu cầu xem xét.' ELSE 'Theo dõi tiến độ hồ sơ và liên hệ cơ quan nếu cần.' END);
    END IF;
  END IF;
  SELECT row_to_json(s) INTO v_reason FROM (
    SELECT reason, stage_name, unit_name, created_at FROM citizen_case_stage_updates
    WHERE application_id = p_application_id AND btrim(reason) <> '' ORDER BY created_at DESC, id DESC LIMIT 1) s;
  RETURN json_build_object('applicationId', p_application_id, 'dueAt', r.due_at, 'daysLeft', r.days_left, 'level', v_level,
    'explanation', v_reason, 'notice', CASE WHEN v_reason IS NOT NULL
      THEN 'Lý do dưới đây do cán bộ nhập ở công đoạn xử lý, không phải giải thích tự động của hệ thống.'
      ELSE 'Chưa có lý do thay đổi thời hạn được cán bộ cập nhật. Cảnh báo chỉ dựa trên hạn xử lý đã lưu.' END);
END $$;

-- ===== 3. Bổ sung theo yêu cầu của cán bộ =====
CREATE OR REPLACE FUNCTION api.citizen_supplement_items(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_event bigint; v json;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ');
  END IF;
  SELECT max(id) INTO v_event FROM application_events WHERE application_id = p_application_id AND event_type = 'supplement';
  SELECT coalesce(json_agg(i ORDER BY i.created_at, i.id), '[]'::json) INTO v FROM (
    SELECT id, kind, target_key, instruction, reason, citizen_response, document_id, responded_at, created_at
    FROM citizen_supplement_items WHERE application_id = p_application_id AND request_event_id = v_event) i;
  RETURN json_build_object('items', v, 'structured', json_array_length(v) > 0);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_supplement_answer(p_application_id text, p_item_id uuid, p_response text DEFAULT NULL,
  p_document_id uuid DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id AND status = 'supplement') THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy yêu cầu bổ sung');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM citizen_supplement_items WHERE id = p_item_id AND application_id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Yêu cầu bổ sung không tồn tại');
  END IF;
  IF p_response IS NOT NULL AND length(btrim(p_response)) NOT BETWEEN 2 AND 1000 THEN
    PERFORM public.citizen_fail(400, 'Nội dung giải trình phải từ 2 đến 1000 ký tự');
  END IF;
  IF NOT coalesce(public.citizen_answer_supplement_item(p_item_id, nullif(btrim(p_response), ''), p_document_id), false) THEN
    PERFORM public.citizen_fail(422, 'Nội dung không hợp lệ, giấy tờ không đúng yêu cầu hoặc yêu cầu đã hết hiệu lực');
  END IF;
  RETURN json_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_complete_supplement(p_application_id text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_status text; v_event bigint; r record; v_requested int := 0; v_new int;
BEGIN
  SELECT status INTO v_status FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'supplement' THEN
    PERFORM public.citizen_fail(409, 'Hồ sơ không ở trạng thái yêu cầu bổ sung');
  END IF;
  SELECT id INTO v_event FROM application_events WHERE application_id = p_application_id AND event_type = 'supplement'
  ORDER BY id DESC LIMIT 1;
  FOR r IN SELECT kind, target_key, citizen_response, document_id, created_at FROM citizen_supplement_items
           WHERE application_id = p_application_id AND request_event_id = v_event LOOP
    v_requested := v_requested + 1;
    IF r.kind = 'field' AND btrim(coalesce(r.citizen_response, '')) = '' THEN
      PERFORM public.citizen_fail(422, 'Còn nội dung kê khai cần giải trình. Vui lòng hoàn thiện từng yêu cầu.');
    END IF;
    IF r.kind = 'document' AND (r.document_id IS NULL OR NOT EXISTS (SELECT 1 FROM application_documents
         WHERE id = r.document_id AND application_id = p_application_id AND document_code = r.target_key AND uploaded_at > r.created_at)) THEN
      PERFORM public.citizen_fail(422, 'Còn giấy tờ theo yêu cầu cán bộ chưa được bổ sung đúng loại.');
    END IF;
  END LOOP;
  SELECT count(*) INTO v_new FROM application_documents d WHERE d.application_id = p_application_id
    AND d.uploaded_at > coalesce((SELECT max(e.created_at) FROM application_events e
                                  WHERE e.application_id = p_application_id AND e.event_type = 'supplement'), 'epoch'::timestamptz);
  IF v_requested = 0 AND v_new = 0 THEN PERFORM public.citizen_fail(422, 'Vui lòng tải ít nhất một giấy tờ bổ sung'); END IF;
  UPDATE applications SET status = 'processing', updated_at = now() WHERE id = p_application_id;
  INSERT INTO application_events(application_id, event_type, note, actor_name)
  VALUES (p_application_id, 'processing', 'Công dân đã gửi bổ sung giấy tờ.', a.display_name);
  INSERT INTO citizen_notifications(citizen_id, tenant_id, application_id, title, body)
  VALUES (a.citizen_id, a.tenant_id, p_application_id, 'Đã gửi bổ sung hồ sơ', 'Giấy tờ bổ sung đã được ghi nhận (mẫu).');
  RETURN json_build_object('ok', true);
END $$;

-- ===== 4. Nhận kết quả =====
CREATE OR REPLACE FUNCTION api.citizen_case_delivery(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record; v_options json; v_selection json;
BEGIN
  SELECT procedure_id, status, coalesce(receiving_tenant_id, tenant_id) AS tenant INTO r FROM applications WHERE id = p_application_id;
  IF r.procedure_id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  SELECT coalesce(json_agg(o ORDER BY o.method), '[]'::json) INTO v_options FROM (
    SELECT method, approval_reference, instructions FROM citizen_result_channels
    WHERE procedure_id = r.procedure_id AND tenant_id = r.tenant AND enabled AND valid_until > now()) o;
  SELECT row_to_json(s) INTO v_selection FROM (
    SELECT method, delivery_address, contact_phone, status, shipment_reference, staff_note, updated_at
    FROM citizen_case_deliveries WHERE application_id = p_application_id) s;
  RETURN json_build_object('options', v_options, 'selection', v_selection, 'applicationStatus', r.status,
    'notice', CASE WHEN json_array_length(v_options) > 0
      THEN 'Chỉ các phương thức được cơ quan công bố còn hiệu lực mới có thể lựa chọn.'
      ELSE 'Cơ quan chưa công bố phương thức nhận kết quả cho thủ tục và địa phương này; vui lòng liên hệ bộ phận một cửa.' END);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_case_delivery_select(p_application_id text, p_method text, p_delivery_address text DEFAULT '',
  p_contact_phone text DEFAULT '') RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record; v_existing text;
  v_address text := btrim(coalesce(p_delivery_address, '')); v_phone text := btrim(coalesce(p_contact_phone, ''));
BEGIN
  IF p_method NOT IN ('online', 'counter', 'postal') THEN PERFORM public.citizen_fail(400, 'Phương thức không hợp lệ'); END IF;
  SELECT procedure_id, status, coalesce(receiving_tenant_id, tenant_id) AS tenant INTO r
  FROM applications WHERE id = p_application_id FOR UPDATE;
  IF r.procedure_id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  IF r.status IN ('draft', 'rejected', 'withdrawn') THEN
    PERFORM public.citizen_fail(409, 'Hồ sơ chưa đủ điều kiện lựa chọn nhận kết quả');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM citizen_result_channels WHERE procedure_id = r.procedure_id AND tenant_id = r.tenant
                 AND method = p_method AND enabled AND valid_until > now()) THEN
    PERFORM public.citizen_fail(422, 'Phương thức nhận kết quả chưa được phê duyệt cho thủ tục này');
  END IF;
  IF p_method = 'postal' AND (length(v_address) < 10 OR length(v_address) > 500 OR v_phone !~ '^\+?[0-9\s.-]{9,20}$') THEN
    PERFORM public.citizen_fail(422, 'Cần địa chỉ giao nhận và số điện thoại hợp lệ');
  END IF;
  SELECT status INTO v_existing FROM citizen_case_deliveries WHERE application_id = p_application_id FOR UPDATE;
  IF v_existing IS NOT NULL AND v_existing <> 'selected' THEN
    PERFORM public.citizen_fail(409, 'Phương thức nhận kết quả đã được cơ quan xác nhận, không thể tự thay đổi');
  END IF;
  INSERT INTO citizen_case_deliveries(application_id, citizen_id, tenant_id, method, delivery_address, contact_phone)
  VALUES (p_application_id, a.citizen_id, a.tenant_id, p_method,
    CASE WHEN p_method = 'postal' THEN v_address ELSE '' END, CASE WHEN p_method = 'postal' THEN v_phone ELSE '' END)
  ON CONFLICT (application_id) DO UPDATE SET method = EXCLUDED.method, delivery_address = EXCLUDED.delivery_address,
    contact_phone = EXCLUDED.contact_phone, updated_at = now();
  INSERT INTO application_events(application_id, event_type, note, actor_name)
  VALUES (p_application_id, 'delivery_selected', 'Công dân đăng ký nhận kết quả: ' || p_method, a.display_name);
  RETURN json_build_object('ok', true, 'method', p_method, 'status', 'selected');
END $$;

-- ===== 5. Mã chuyển hồ sơ tại quầy (cán bộ dùng mã qua api.redeem_citizen_handoff) =====
CREATE OR REPLACE FUNCTION api.citizen_case_handoffs(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ');
  END IF;
  RETURN coalesce((SELECT json_agg(h ORDER BY h."createdAt" DESC) FROM (
    SELECT id AS "handoffId", expires_at AS "expiresAt", created_at AS "createdAt", revoked_at AS "revokedAt",
      redeemed_at AS "redeemedAt", redeemed_by AS "redeemedBy"
    FROM citizen_case_handoffs WHERE application_id = p_application_id ORDER BY created_at DESC LIMIT 8) h), '[]'::json);
END $$;

-- p_code_hash: SHA-256 (hex) của mã ngẫu nhiên do Kênh người dân sinh; lõi không bao giờ thấy mã gốc.
CREATE OR REPLACE FUNCTION api.citizen_case_handoff_create(p_application_id text, p_code_hash text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_status text; v_row record;
BEGIN
  IF coalesce(p_code_hash, '') !~ '^[0-9a-f]{64}$' THEN PERFORM public.citizen_fail(400, 'Mã không hợp lệ'); END IF;
  SELECT status INTO v_status FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ của bạn'); END IF;
  IF v_status <> 'draft' THEN PERFORM public.citizen_fail(409, 'Chỉ có thể chuyển tiếp hồ sơ đang chuẩn bị (bản nháp)'); END IF;
  IF (SELECT count(*) FROM citizen_case_handoffs WHERE application_id = p_application_id AND created_at > now() - interval '1 hour') >= 5 THEN
    PERFORM public.citizen_fail(429, 'Đã tạo quá nhiều mã; hãy thử lại sau');
  END IF;
  UPDATE citizen_case_handoffs SET revoked_at = now()
  WHERE application_id = p_application_id AND revoked_at IS NULL AND redeemed_at IS NULL;
  INSERT INTO citizen_case_handoffs(application_id, citizen_id, tenant_id, code_hash, expires_at)
  VALUES (p_application_id, a.citizen_id, a.tenant_id, p_code_hash, now() + interval '15 minutes')
  RETURNING id, expires_at INTO v_row;
  RETURN json_build_object('handoffId', v_row.id, 'expiresAt', v_row.expires_at, 'applicationId', p_application_id);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_case_handoff_revoke(p_application_id text, p_handoff_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  UPDATE citizen_case_handoffs SET revoked_at = now()
  WHERE id = p_handoff_id AND application_id = p_application_id AND revoked_at IS NULL AND redeemed_at IS NULL;
  IF NOT FOUND THEN PERFORM public.citizen_fail(409, 'Mã không còn hiệu lực hoặc đã được tiếp nhận'); END IF;
  RETURN json_build_object('ok', true);
END $$;

-- ===== 6. Đề nghị điều chỉnh, xem xét hạn, rút, chuyển cơ quan =====
CREATE OR REPLACE FUNCTION api.citizen_my_case_requests(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ');
  END IF;
  RETURN json_build_object('items', coalesce((SELECT json_agg(q ORDER BY q.created_at DESC) FROM (
    SELECT id, request_kind, reason, proposed_tenant_id, status, staff_response, decided_by, created_at, decided_at
    FROM citizen_case_requests WHERE application_id = p_application_id ORDER BY created_at DESC LIMIT 100) q), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_case_request_create(p_application_id text, p_kind text, p_reason text,
  p_destination_tenant_id uuid DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record; v_current uuid; v_row record; v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF p_kind NOT IN ('deadline_review', 'amendment', 'withdrawal', 'transfer') THEN PERFORM public.citizen_fail(400, 'Loại đề nghị không hợp lệ'); END IF;
  IF length(v_reason) NOT BETWEEN 10 AND 2000 THEN PERFORM public.citizen_fail(400, 'Lý do phải từ 10 đến 2000 ký tự'); END IF;
  SELECT id, procedure_id, status, tenant_id, receiving_tenant_id INTO r FROM applications WHERE id = p_application_id FOR UPDATE;
  IF r.id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  IF r.status NOT IN ('submitted', 'processing', 'supplement') THEN
    PERFORM public.citizen_fail(409, 'Trạng thái hồ sơ hiện không cho phép gửi đề nghị này');
  END IF;
  v_current := coalesce(r.receiving_tenant_id, r.tenant_id);
  IF p_kind = 'transfer' THEN
    IF p_destination_tenant_id IS NULL OR p_destination_tenant_id = v_current THEN
      PERFORM public.citizen_fail(422, 'Vui lòng chọn cơ quan nhận khác cơ quan hiện tại');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM citizen_procedure_receivers WHERE procedure_id = r.procedure_id AND source_tenant_id = v_current
                   AND receiving_tenant_id = p_destination_tenant_id AND enabled AND btrim(approval_reference) <> '' AND valid_until > now()) THEN
      PERFORM public.citizen_fail(422, 'Chưa có tuyến chuyển tiếp được cơ quan phê duyệt');
    END IF;
    IF EXISTS (SELECT 1 FROM citizen_case_transfer_handoffs WHERE application_id = p_application_id AND status = 'pending') THEN
      PERFORM public.citizen_fail(409, 'Hồ sơ đang chờ một cơ quan khác tiếp nhận, không thể tạo thêm đề nghị chuyển');
    END IF;
  ELSIF p_destination_tenant_id IS NOT NULL THEN
    PERFORM public.citizen_fail(422, 'Không cần thông tin cơ quan nhận');
  END IF;
  IF (SELECT count(*) FROM citizen_case_requests WHERE created_at > now() - interval '24 hours') >= 8 THEN
    PERFORM public.citizen_fail(429, 'Bạn đã gửi quá nhiều yêu cầu trong 24 giờ');
  END IF;
  IF EXISTS (SELECT 1 FROM citizen_case_requests WHERE application_id = p_application_id AND request_kind = p_kind AND status = 'pending') THEN
    PERFORM public.citizen_fail(409, 'Đã có đề nghị cùng loại đang chờ giải quyết');
  END IF;
  INSERT INTO citizen_case_requests(application_id, citizen_id, tenant_id, request_kind, reason, proposed_tenant_id)
  VALUES (p_application_id, a.citizen_id, a.tenant_id, p_kind, v_reason, p_destination_tenant_id)
  RETURNING id, request_kind, status, created_at INTO v_row;
  INSERT INTO application_events(application_id, event_type, note, actor_name)
  VALUES (p_application_id, 'citizen_request', 'Công dân gửi đề nghị: ' || p_kind, a.display_name);
  RETURN row_to_json(v_row);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_case_routing(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record; p record; v_candidates json; v_suggested uuid;
BEGIN
  SELECT ap.procedure_id, ap.status, coalesce(ap.receiving_tenant_id, ap.tenant_id) AS current_id, t.name AS current_name
  INTO r FROM applications ap JOIN tenants t ON t.id = coalesce(ap.receiving_tenant_id, ap.tenant_id) WHERE ap.id = p_application_id;
  IF r.procedure_id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  SELECT coalesce(json_agg(c ORDER BY c.tenant_name), '[]'::json) INTO v_candidates FROM (
    SELECT cr.receiving_tenant_id AS tenant_id, t.name AS tenant_name, cr.approval_reference, cr.valid_until
    FROM citizen_procedure_receivers cr JOIN tenants t ON t.id = cr.receiving_tenant_id
    WHERE cr.procedure_id = r.procedure_id AND cr.source_tenant_id = r.current_id AND cr.enabled
      AND cr.valid_until > now() AND btrim(cr.approval_reference) <> '') c;
  SELECT residence_tenant_id, temporary_tenant_id, locality_source, locality_verified_at INTO p
  FROM citizen_service_preferences WHERE citizen_id = a.citizen_id;
  v_suggested := coalesce(p.residence_tenant_id, p.temporary_tenant_id);
  IF v_suggested IS NOT NULL AND NOT EXISTS (SELECT 1 FROM json_array_elements(v_candidates) c
                                             WHERE (c ->> 'tenant_id')::uuid = v_suggested) THEN
    v_suggested := NULL;
  END IF;
  RETURN json_build_object('currentTenantId', r.current_id, 'currentTenantName', r.current_name, 'candidates', v_candidates,
    'transfers', coalesce((SELECT json_agg(h ORDER BY h.created_at DESC) FROM (
      SELECT h.id, h.source_tenant_id, h.destination_tenant_id, t.name AS destination_name, h.status, h.created_at,
        h.decided_at, h.decision_note FROM citizen_case_transfer_handoffs h JOIN tenants t ON t.id = h.destination_tenant_id
      WHERE h.application_id = p_application_id ORDER BY h.created_at DESC LIMIT 30) h), '[]'::json),
    'applicationStatus', r.status, 'suggestedTenantId', v_suggested,
    'verifiedLocality', coalesce(p.locality_source = 'oidc_verified' AND p.locality_verified_at IS NOT NULL, false),
    'notice', 'Gợi ý dựa trên tuyến được công bố và địa phương khai báo. Cơ quan có thẩm quyền phải xem xét và xác nhận chuyển giao; thông tin cư trú tự khai không thay thế xác minh pháp lý.');
END $$;

-- ===== 7. Đánh giá từng giai đoạn =====
CREATE OR REPLACE FUNCTION api.citizen_stage_reviews(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ');
  END IF;
  RETURN json_build_object('items', coalesce((SELECT json_agg(s ORDER BY s.created_at DESC) FROM (
    SELECT id, stage, rating, comment, created_at FROM citizen_stage_reviews WHERE application_id = p_application_id) s), '[]'::json));
END $$;

-- Điều kiện như shared/stage-feedback.ts (stageEligible): chỉ đánh giá giai đoạn hồ sơ đã trải qua.
CREATE OR REPLACE FUNCTION api.citizen_stage_review_create(p_application_id text, p_stage text, p_rating integer,
  p_comment text DEFAULT '') RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_status text; v_row record;
BEGIN
  IF p_stage NOT IN ('guidance', 'reception', 'supplement', 'result') THEN PERFORM public.citizen_fail(400, 'Giai đoạn không hợp lệ'); END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN PERFORM public.citizen_fail(400, 'Điểm đánh giá từ 1 đến 5'); END IF;
  IF length(btrim(coalesce(p_comment, ''))) > 1000 THEN PERFORM public.citizen_fail(400, 'Nhận xét tối đa 1000 ký tự'); END IF;
  SELECT status INTO v_status FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  IF NOT (p_stage = 'guidance'
       OR (p_stage = 'reception' AND (v_status <> 'draft' OR EXISTS (SELECT 1 FROM application_events WHERE application_id = p_application_id AND event_type = 'submitted')))
       OR (p_stage = 'supplement' AND (v_status = 'supplement' OR EXISTS (SELECT 1 FROM application_events WHERE application_id = p_application_id AND event_type = 'supplement')))
       OR (p_stage = 'result' AND (v_status = 'completed' OR EXISTS (SELECT 1 FROM application_events WHERE application_id = p_application_id AND event_type = 'completed')))) THEN
    PERFORM public.citizen_fail(409, 'Hồ sơ chưa đến giai đoạn có thể đánh giá');
  END IF;
  INSERT INTO citizen_stage_reviews(application_id, citizen_id, tenant_id, stage, rating, comment)
  VALUES (p_application_id, a.citizen_id, a.tenant_id, p_stage, p_rating, btrim(coalesce(p_comment, '')))
  ON CONFLICT (application_id, citizen_id, stage) DO NOTHING
  RETURNING id, stage, rating, comment, created_at INTO v_row;
  IF v_row.id IS NULL THEN PERFORM public.citizen_fail(409, 'Bạn đã đánh giá giai đoạn này'); END IF;
  RETURN row_to_json(v_row);
END $$;

-- ===== 8. Kiểm tra bản nháp trước khi nộp, đối chiếu giấy tờ, xem trước bộ hồ sơ =====
-- Dữ kiện để Kênh người dân dựng danh sách lỗi (utils/preflight.ts); kiểm tra biểu mẫu dùng shared/procedure-forms.ts.
CREATE OR REPLACE FUNCTION api.citizen_draft_preflight(p_application_id text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record; v_applicant boolean := true;
BEGIN
  SELECT * INTO r FROM applications WHERE id = p_application_id;
  IF r.id IS NULL OR r.status <> 'draft' THEN PERFORM public.citizen_fail(404, 'Không tìm thấy bản nháp của bạn'); END IF;
  BEGIN
    PERFORM public.citizen_check_applicant(r.representation_id, r.procedure_id, r.applicant_name);
  EXCEPTION WHEN others THEN v_applicant := false;
  END;
  RETURN json_build_object('procedure_id', r.procedure_id, 'form_data', r.form_data, 'applicant_phone', r.applicant_phone,
    'published', EXISTS (SELECT 1 FROM procedures WHERE id = r.procedure_id AND published),
    'receiver_ok', public.citizen_receiver_permitted(r.procedure_id, a.tenant_id, coalesce(r.receiving_tenant_id, a.tenant_id)),
    'applicant_ok', v_applicant,
    'missing_documents', coalesce((SELECT json_agg(json_build_object('document_code', d.document_code, 'document_name', d.document_name)
        ORDER BY d.document_code) FROM procedure_documents d
      WHERE d.procedure_id = r.procedure_id AND d.is_required AND NOT EXISTS (
        SELECT 1 FROM application_documents f WHERE f.application_id = p_application_id AND f.document_code = d.document_code)), '[]'::json));
END $$;

-- p_fields: các trường công dân xác nhận đọc từ giấy tờ (Kênh người dân đã lọc theo biểu mẫu của thủ tục).
CREATE OR REPLACE FUNCTION api.citizen_case_observation_save(p_application_id text, p_document_id uuid, p_fields jsonb) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF jsonb_typeof(p_fields) IS DISTINCT FROM 'object' OR p_fields = '{}'::jsonb THEN
    PERFORM public.citizen_fail(422, 'Chưa có dữ liệu để đối chiếu');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id AND status IN ('draft', 'supplement')) THEN
    PERFORM public.citizen_fail(404, 'Hồ sơ không còn cho phép lưu đối chiếu');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM application_documents WHERE id = p_document_id AND application_id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Giấy tờ không thuộc hồ sơ của bạn');
  END IF;
  INSERT INTO citizen_document_observations(citizen_id, tenant_id, application_id, document_id, fields)
  VALUES (a.citizen_id, a.tenant_id, p_application_id, p_document_id, p_fields)
  ON CONFLICT (document_id) DO UPDATE SET fields = EXCLUDED.fields, confirmed_at = now();
  PERFORM public.citizen_record_access('view_case', 'Công dân xác nhận thông tin nhận dạng để đối chiếu giấy tờ', 'application', p_application_id);
  RETURN json_build_object('saved', true,
    'notice', 'Đã lưu dữ liệu do bạn xác nhận để rà soát mâu thuẫn. Không tự đánh giá giấy tờ hợp lệ hay không.');
END $$;

CREATE OR REPLACE FUNCTION api.citizen_packet_sources(p_application_id text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); r record;
BEGIN
  SELECT id, status, procedure_id, form_data, representation_id INTO r FROM applications WHERE id = p_application_id;
  IF r.id IS NULL OR r.status <> 'draft' THEN PERFORM public.citizen_fail(404, 'Không tìm thấy bản nháp để chuẩn bị hồ sơ'); END IF;
  IF r.representation_id IS NOT NULL THEN
    PERFORM public.citizen_fail(403, 'Không lấy dữ liệu cá nhân của người đại diện để điền hộ hồ sơ');
  END IF;
  PERFORM public.citizen_record_access('read_autofill', 'Xem trước gợi ý tạo bộ hồ sơ từ dữ liệu cá nhân', 'application', p_application_id);
  RETURN json_build_object('procedure_id', r.procedure_id, 'form_data', r.form_data,
    'profile', (SELECT json_build_object('display_name', display_name, 'phone', phone, 'address', address) FROM citizens WHERE id = a.citizen_id),
    'self', (SELECT json_build_object('birth_date', to_char(birth_date, 'YYYY-MM-DD'), 'citizen_identifier', citizen_identifier)
             FROM citizen_self_facts WHERE citizen_id = a.citizen_id),
    'verified', coalesce((SELECT json_agg(json_build_object('field_key', field_key, 'field_value', field_value,
                  'source_issuer', source_issuer, 'verified_at', verified_at)) FROM citizen_verified_facts WHERE citizen_id = a.citizen_id), '[]'::json),
    'vault', coalesce((SELECT json_agg(x ORDER BY x.created_at DESC) FROM (
       SELECT d.id, d.title, d.category, v.id AS version_id, v.original_name, v.expires_on, d.created_at
       FROM citizen_vault_documents d
       JOIN LATERAL (SELECT id, original_name, expires_on FROM citizen_vault_versions WHERE document_id = d.id
                     ORDER BY version_no DESC LIMIT 1) v ON true
       WHERE d.archived_at IS NULL ORDER BY d.created_at DESC LIMIT 40) x), '[]'::json),
    'documents', coalesce((SELECT json_agg(json_build_object('document_code', document_code, 'document_name', document_name,
                  'is_required', is_required) ORDER BY document_code) FROM procedure_documents WHERE procedure_id = r.procedure_id), '[]'::json),
    'attached', coalesce((SELECT json_agg(DISTINCT document_code) FROM application_documents WHERE application_id = p_application_id), '[]'::json));
END $$;

-- ===== 9. Phiên bản thủ tục thay đổi khi đang soạn bản nháp =====
CREATE OR REPLACE FUNCTION public.citizen_procedure_change(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  ap record; cur record; ini record; ack record;
  v_from_snapshot jsonb; v_from_url text; v_from_ref text; v_from_scope text; v_has_from boolean;
  v_changed text[] := '{}'; m text[];
BEGIN
  SELECT id, procedure_id, status, procedure_version_id, acknowledged_procedure_version_id INTO ap
  FROM applications WHERE id = p_application_id;
  IF ap.id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ thuộc tài khoản'); END IF;
  SELECT id, version_no, effective_from, source_url, source_reference, scope_note, provenance_status, change_note, snapshot INTO cur
  FROM citizen_procedure_versions WHERE procedure_id = ap.procedure_id ORDER BY version_no DESC LIMIT 1;
  IF cur.id IS NULL THEN PERFORM public.citizen_fail(409, 'Chưa có phiên bản thủ tục được đăng ký'); END IF;
  SELECT id, version_no, snapshot, source_url, source_reference, scope_note INTO ini
  FROM citizen_procedure_versions WHERE id = ap.procedure_version_id;
  SELECT id, version_no, snapshot, source_url, source_reference, scope_note INTO ack
  FROM citizen_procedure_versions WHERE id = ap.acknowledged_procedure_version_id;
  v_has_from := ack.id IS NOT NULL OR ini.id IS NOT NULL;
  IF ack.id IS NOT NULL THEN
    v_from_snapshot := ack.snapshot; v_from_url := ack.source_url; v_from_ref := ack.source_reference; v_from_scope := ack.scope_note;
  ELSE
    v_from_snapshot := ini.snapshot; v_from_url := ini.source_url; v_from_ref := ini.source_reference; v_from_scope := ini.scope_note;
  END IF;
  IF v_has_from THEN
    FOREACH m SLICE 1 IN ARRAY ARRAY[['documents','documents'],['feeNote','fees'],['slaDays','deadline'],['formRevision','forms'],
                                    ['instructions','conditions'],['title','description'],['summary','description']] LOOP
      IF v_from_snapshot -> m[1] IS DISTINCT FROM cur.snapshot -> m[1] AND NOT m[2] = ANY (v_changed) THEN
        v_changed := v_changed || m[2];
      END IF;
    END LOOP;
    IF v_from_url IS DISTINCT FROM cur.source_url OR v_from_ref IS DISTINCT FROM cur.source_reference THEN v_changed := v_changed || 'source'::text; END IF;
    IF v_from_scope IS DISTINCT FROM cur.scope_note THEN v_changed := v_changed || 'scope'::text; END IF;
  END IF;
  RETURN json_build_object('applicationId', ap.id, 'status', ap.status,
    'needsReview', ap.status = 'draft' AND ap.acknowledged_procedure_version_id IS DISTINCT FROM cur.id,
    'originalVersion', ini.version_no, 'reviewedVersion', ack.version_no, 'currentVersion', cur.version_no, 'currentId', cur.id,
    'changedSections', to_json(v_changed), 'changeNote', cur.change_note, 'sourceUrl', cur.source_url,
    'sourceReference', cur.source_reference, 'provenanceStatus', cur.provenance_status, 'effectiveFrom', cur.effective_from);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_procedure_change(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN public.citizen_procedure_change(p_application_id);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_procedure_change_ack(p_application_id text, p_current_version_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_procedure text; v_status text; v_change json;
BEGIN
  SELECT procedure_id INTO v_procedure FROM applications WHERE id = p_application_id;
  IF v_procedure IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  PERFORM public.lock_procedure_shared(v_procedure);
  SELECT status INTO v_status FROM applications WHERE id = p_application_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'draft' THEN PERFORM public.citizen_fail(409, 'Chỉ bản nháp mới được xác nhận cập nhật quy định'); END IF;
  v_change := public.citizen_procedure_change(p_application_id);
  IF (v_change ->> 'currentId')::uuid IS DISTINCT FROM p_current_version_id THEN
    PERFORM public.citizen_fail(409, 'Phiên bản thủ tục vừa thay đổi, vui lòng tải lại');
  END IF;
  UPDATE applications SET acknowledged_procedure_version_id = p_current_version_id, updated_at = now() WHERE id = p_application_id;
  INSERT INTO application_events(application_id, event_type, note, actor_name)
  VALUES (p_application_id, 'procedure_reviewed', 'Công dân đã rà soát phiên bản thủ tục ' || (v_change ->> 'currentVersion') || '.', a.display_name);
  RETURN json_build_object('ok', true, 'version', (v_change ->> 'currentVersion')::int);
END $$;

-- ===== 10. Tạo bản nháp mới từ hồ sơ đã kết thúc =====
CREATE OR REPLACE FUNCTION public.citizen_reapply_original(p_application_id text) RETURNS applications
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE o applications;
BEGIN
  SELECT * INTO o FROM applications WHERE id = p_application_id;
  IF o.id IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ'); END IF;
  IF o.status NOT IN ('rejected', 'completed', 'withdrawn') THEN
    PERFORM public.citizen_fail(409, 'Chỉ tạo lại từ hồ sơ đã kết thúc hoặc được rút');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM procedures WHERE id = o.procedure_id AND published) THEN
    PERFORM public.citizen_fail(409, 'Thủ tục không còn được công bố');
  END IF;
  RETURN o;
END $$;

-- Bước 1: thủ tục và biểu mẫu của hồ sơ gốc để Kênh người dân lọc lại theo biểu mẫu hiện hành.
CREATE OR REPLACE FUNCTION api.citizen_application_reapply_source(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); o applications := public.citizen_reapply_original(p_application_id);
BEGIN
  RETURN json_build_object('procedure_id', o.procedure_id, 'form_data', o.form_data);
END $$;

-- Bước 2: tạo bản nháp qua api.citizen_application_create (ghim phiên bản thủ tục, kiểm tra người kê khai,
-- đại diện, xã tiếp nhận). Giấy tờ không sao chép. Tuyến tiếp nhận cũ không còn hiệu lực thì nộp về xã của công dân.
CREATE OR REPLACE FUNCTION api.citizen_application_reapply(p_application_id text, p_form_data jsonb) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); o applications := public.citizen_reapply_original(p_application_id);
  v_target uuid; v json;
BEGIN
  v_target := coalesce(o.receiving_tenant_id, a.tenant_id);
  IF NOT public.citizen_receiver_permitted(o.procedure_id, a.tenant_id, v_target) THEN v_target := a.tenant_id; END IF;
  v := api.citizen_application_create(o.procedure_id, o.applicant_name, o.applicant_phone, o.description,
         coalesce(p_form_data, '{}'::jsonb), v_target, o.representation_id, NULL);
  INSERT INTO application_events(application_id, event_type, note, actor_name)
  VALUES (v ->> 'id', 'reapplied_from', 'Tạo nháp mới từ hồ sơ ' || p_application_id
    || '. Giấy tờ cần đính kèm lại và hồ sơ phải kiểm tra trước nộp.', a.display_name);
  RETURN json_build_object('id', v ->> 'id', 'procedureId', o.procedure_id, 'status', 'draft', 'documentsCopied', false);
END $$;

-- ===== 11. Mã kiểm chứng kết quả =====
CREATE OR REPLACE FUNCTION api.citizen_result_check(p_application_id text) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id AND status = 'completed') THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy kết quả đã hoàn thành của bạn');
  END IF;
  RETURN json_build_object('ok', true);
END $$;

-- p_token_hash: SHA-256 (hex) của mã tra cứu do Kênh người dân sinh; p_document_sha256, p_reference: từ dịch vụ cấp kết quả.
CREATE OR REPLACE FUNCTION api.citizen_result_verification_issue(p_application_id text, p_token_hash text,
  p_document_sha256 text, p_reference text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_expires timestamptz;
BEGIN
  IF coalesce(p_token_hash, '') !~ '^[0-9a-f]{64}$' THEN PERFORM public.citizen_fail(400, 'Mã không hợp lệ'); END IF;
  PERFORM 1 FROM applications WHERE id = p_application_id AND status = 'completed' FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.citizen_fail(409, 'Trạng thái hồ sơ đã thay đổi'); END IF;
  UPDATE citizen_result_verifications SET revoked_at = now() WHERE application_id = p_application_id AND revoked_at IS NULL;
  PERFORM public.citizen_record_access('issue_result_code', 'Cấp mã tra cứu kết quả được phát hành', 'application', p_application_id);
  INSERT INTO citizen_result_verifications(citizen_id, tenant_id, application_id, token_hash, document_sha256, result_reference,
    provider_verification, expires_at)
  VALUES (a.citizen_id, a.tenant_id, p_application_id, p_token_hash, p_document_sha256, p_reference, 'verified', now() + interval '180 days')
  RETURNING expires_at INTO v_expires;
  RETURN json_build_object('expires_at', v_expires);
END $$;

-- ===== 12. Quyền gọi =====
DO $$
DECLARE f text;
BEGIN
  REVOKE ALL ON FUNCTION public.citizen_procedure_change(text), public.citizen_reapply_original(text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.citizen_procedure_change(text), public.citizen_reapply_original(text) TO "citizen-app";
  FOREACH f IN ARRAY ARRAY['api.citizen_case_facts(text)', 'api.citizen_case_insight_facts(text)', 'api.citizen_case_roadmap(text)',
    'api.citizen_case_stages(text)', 'api.citizen_case_deadline(text)', 'api.citizen_supplement_items(text)',
    'api.citizen_supplement_answer(text, uuid, text, uuid)', 'api.citizen_complete_supplement(text)',
    'api.citizen_case_delivery(text)', 'api.citizen_case_delivery_select(text, text, text, text)',
    'api.citizen_case_handoffs(text)', 'api.citizen_case_handoff_create(text, text)', 'api.citizen_case_handoff_revoke(text, uuid)',
    'api.citizen_my_case_requests(text)', 'api.citizen_case_request_create(text, text, text, uuid)', 'api.citizen_case_routing(text)',
    'api.citizen_stage_reviews(text)', 'api.citizen_stage_review_create(text, text, integer, text)',
    'api.citizen_draft_preflight(text)', 'api.citizen_case_observation_save(text, uuid, jsonb)', 'api.citizen_packet_sources(text)',
    'api.citizen_procedure_change(text)', 'api.citizen_procedure_change_ack(text, uuid)',
    'api.citizen_application_reapply_source(text)', 'api.citizen_application_reapply(text, jsonb)',
    'api.citizen_result_check(text)', 'api.citizen_result_verification_issue(text, text, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
