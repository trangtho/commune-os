-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API của lõi cho yêu cầu hỗ trợ, góp ý, tin nhắn hỗ trợ theo hồ sơ và lịch sử trò chuyện với trợ lý của Kênh người dân.
-- Gọi qua cổng APISIX (POST /rest/rpc/<tên hàm>) bằng token Keycloak của công dân; SECURITY INVOKER, RLS theo công dân.
-- Cán bộ trả lời yêu cầu hỗ trợ qua api.citizen_support_tickets / api.update_citizen_support_ticket (26-citizen-staff-api.sql).
-- Nội dung trò chuyện chỉ lưu cho chính công dân, không đưa vào kho tri thức của trợ lý. Chạy lại nhiều lần được.

-- ===== 1. Yêu cầu hỗ trợ =====
CREATE OR REPLACE FUNCTION api.citizen_tickets(p_status text DEFAULT '', p_q text DEFAULT '', p_page integer DEFAULT 1) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
  v_status text := CASE WHEN p_status IN ('received','processing','waiting_citizen','answered','resolved','closed','reopened') THEN p_status ELSE '' END;
  v_q text := left(regexp_replace(btrim(coalesce(p_q, '')), '^YC-', '', 'i'), 80);
  v_total int; v_pages int; v_page int;
BEGIN
  SELECT count(*) INTO v_total FROM citizen_support_tickets
  WHERE (v_status = '' OR status = v_status)
    AND (v_q = '' OR position(lower(v_q) IN lower(subject)) > 0 OR position(lower(v_q) IN lower(id::text)) > 0);
  v_pages := greatest(1, ceil(v_total / 10.0)::int);
  v_page := least(greatest(coalesce(p_page, 1), 1), v_pages);
  RETURN json_build_object('total', v_total, 'page', v_page, 'pageSize', 10, 'items', coalesce((SELECT json_agg(t ORDER BY t."updatedAt" DESC, t.id DESC) FROM (
    SELECT id, category, subject, status, assigned_staff AS "assignedStaff", resolution, application_id AS "applicationId",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM citizen_support_tickets
    WHERE (v_status = '' OR status = v_status)
      AND (v_q = '' OR position(lower(v_q) IN lower(subject)) > 0 OR position(lower(v_q) IN lower(id::text)) > 0)
    ORDER BY updated_at DESC, id DESC LIMIT 10 OFFSET (v_page - 1) * 10) t), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_ticket(p_ticket_id uuid) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v jsonb;
BEGIN
  SELECT to_jsonb(t) INTO v FROM (SELECT id, category, subject, status, assigned_staff AS "assignedStaff", resolution,
    application_id AS "applicationId", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM citizen_support_tickets WHERE id = p_ticket_id) t;
  IF v IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy yêu cầu hoặc không có quyền truy cập'); END IF;
  RETURN v || jsonb_build_object('events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM (
    SELECT id, actor_type AS "actorType", actor_name AS "actorName", event_type AS "eventType", message, status, created_at AS "createdAt"
    FROM citizen_support_ticket_events WHERE ticket_id = p_ticket_id ORDER BY id LIMIT 200) e), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_ticket_create(p_category text, p_subject text, p_message text, p_application_id text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_row record;
BEGIN
  IF p_category NOT IN ('huong-dan', 'loi-ky-thuat', 'gop-y', 'phan-anh', 'khac') THEN PERFORM public.citizen_fail(400, 'Loại yêu cầu không hợp lệ'); END IF;
  PERFORM public.check_text(p_subject, 'Tiêu đề', 3, 150), public.check_text(p_message, 'Nội dung', 10, 3000);
  IF (SELECT count(*) FROM citizen_support_tickets WHERE created_at > now() - interval '24 hours') >= 20 THEN
    PERFORM public.citizen_fail(429, 'Bạn đã gửi quá nhiều yêu cầu trong 24 giờ');
  END IF;
  IF nullif(p_application_id, '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Không có quyền truy cập hồ sơ liên quan');
  END IF;
  INSERT INTO citizen_support_tickets(citizen_id, tenant_id, application_id, category, subject)
  VALUES (a.citizen_id, a.tenant_id, nullif(p_application_id, ''), p_category, btrim(p_subject)) RETURNING id, created_at INTO v_row;
  INSERT INTO citizen_support_ticket_events(ticket_id, actor_type, actor_name, event_type, message)
  VALUES (v_row.id, 'citizen', a.display_name, 'message', btrim(p_message));
  RETURN json_build_object('id', v_row.id, 'createdAt', v_row.created_at, 'status', 'received',
    'code', 'YC-' || upper(left(v_row.id::text, 8)));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_ticket_reply(p_ticket_id uuid, p_message text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_status text;
BEGIN
  PERFORM public.check_text(p_message, 'Nội dung', 5, 3000);
  IF (SELECT count(*) FROM citizen_support_ticket_events WHERE ticket_id = p_ticket_id AND actor_type = 'citizen'
      AND created_at > now() - interval '24 hours') >= 40 THEN
    PERFORM public.citizen_fail(429, 'Đã vượt số lượt phản hồi trong 24 giờ');
  END IF;
  v_status := public.citizen_reply_support_ticket(p_ticket_id, btrim(p_message), a.display_name);
  IF v_status IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy yêu cầu hoặc không có quyền trả lời'); END IF;
  RETURN json_build_object('ok', true, 'status', v_status);
END $$;

-- Góp ý cũ: lưu góp ý và mở luôn một yêu cầu hỗ trợ để cán bộ trả lời.
CREATE OR REPLACE FUNCTION api.citizen_feedback() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN coalesce((SELECT json_agg(f ORDER BY f.created_at DESC, f.id DESC) FROM (
    SELECT id, subject, message, created_at FROM citizen_feedback ORDER BY created_at DESC, id DESC LIMIT 50) f), '[]'::json);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_feedback_create(p_category text, p_subject text, p_message text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_feedback uuid; v_ticket uuid;
BEGIN
  IF p_category NOT IN ('huong-dan', 'loi-ky-thuat', 'gop-y', 'phan-anh', 'khac') THEN PERFORM public.citizen_fail(400, 'Loại góp ý không hợp lệ'); END IF;
  PERFORM public.check_text(p_subject, 'Tiêu đề', 3, 130), public.check_text(p_message, 'Nội dung', 10, 3000);
  IF (SELECT count(*) FROM citizen_support_tickets WHERE created_at > now() - interval '24 hours') >= 20 THEN
    PERFORM public.citizen_fail(429, 'Bạn đã gửi quá nhiều yêu cầu trong 24 giờ');
  END IF;
  INSERT INTO citizen_feedback(citizen_id, tenant_id, subject, message)
  VALUES (a.citizen_id, a.tenant_id, '[' || p_category || '] ' || btrim(p_subject), btrim(p_message)) RETURNING id INTO v_feedback;
  INSERT INTO citizen_support_tickets(citizen_id, tenant_id, legacy_feedback_id, category, subject)
  VALUES (a.citizen_id, a.tenant_id, v_feedback, p_category, btrim(p_subject)) RETURNING id INTO v_ticket;
  INSERT INTO citizen_support_ticket_events(ticket_id, actor_type, actor_name, event_type, message)
  VALUES (v_ticket, 'citizen', a.display_name, 'message', btrim(p_message));
  RETURN json_build_object('ok', true, 'ticketId', v_ticket);
END $$;

-- Tin nhắn hỗ trợ gắn với một hồ sơ (kênh cũ, chưa có trả lời của cán bộ).
CREATE OR REPLACE FUNCTION api.citizen_support_messages(p_application_id text DEFAULT NULL) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN coalesce((SELECT json_agg(m ORDER BY m.created_at DESC, m.id DESC) FROM (
    SELECT s.id, s.application_id, s.message, s.created_at, 'received' AS status, NULL::text AS reply
    FROM citizen_support_messages s WHERE (nullif(p_application_id, '') IS NULL OR s.application_id = p_application_id)
    ORDER BY s.created_at DESC, s.id DESC LIMIT 50) m), '[]'::json);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_support_message_create(p_application_id text, p_message text) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  PERFORM public.check_text(p_message, 'Nội dung', 5, 2000);
  IF nullif(p_application_id, '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM applications WHERE id = p_application_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy hồ sơ');
  END IF;
  INSERT INTO citizen_support_messages(citizen_id, tenant_id, application_id, message)
  VALUES (a.citizen_id, a.tenant_id, nullif(p_application_id, ''), btrim(p_message));
  RETURN json_build_object('ok', true);
END $$;

-- ===== 2. Lịch sử trò chuyện với trợ lý =====
CREATE OR REPLACE FUNCTION api.citizen_chat_conversations(p_page integer DEFAULT 1) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF p_page IS NULL OR p_page < 1 OR p_page > 10000 THEN PERFORM public.citizen_fail(400, 'Số trang không hợp lệ'); END IF;
  RETURN json_build_object('total', (SELECT count(*) FROM citizen_ai_conversations), 'page', p_page, 'pageSize', 20,
    'items', coalesce((SELECT json_agg(c ORDER BY c."updatedAt" DESC, c.id DESC) FROM (
      SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt" FROM citizen_ai_conversations
      ORDER BY updated_at DESC, id DESC LIMIT 20 OFFSET (p_page - 1) * 20) c), '[]'::json));
END $$;

-- 60 tin nhắn trước mốc p_before (mã tin nhắn); nextBefore dùng để tải trang cũ hơn.
CREATE OR REPLACE FUNCTION api.citizen_chat_conversation(p_conversation_id uuid, p_before bigint DEFAULT NULL) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_conv json; v_rows jsonb; v_more boolean;
BEGIN
  SELECT json_build_object('id', id, 'title', title, 'createdAt', created_at, 'updatedAt', updated_at) INTO v_conv
  FROM citizen_ai_conversations WHERE id = p_conversation_id;
  IF v_conv IS NULL THEN PERFORM public.citizen_fail(404, 'Không tìm thấy cuộc trò chuyện thuộc tài khoản này'); END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.n DESC), '[]'::jsonb) INTO v_rows FROM (
    SELECT id::text AS id, id AS n, role, content, mode, sources, suggestions, notice, revision, created_at AS "createdAt"
    FROM citizen_ai_messages WHERE conversation_id = p_conversation_id AND (p_before IS NULL OR id < p_before)
    ORDER BY id DESC LIMIT 61) m;
  v_more := jsonb_array_length(v_rows) > 60;
  -- Bỏ phần tử thứ 61 (chỉ để biết còn trang cũ hơn), đảo lại theo thứ tự thời gian, bỏ cột phụ n.
  SELECT coalesce(jsonb_agg(x - 'n' ORDER BY (x ->> 'n')::bigint), '[]'::jsonb) INTO v_rows
  FROM jsonb_array_elements(v_rows) WITH ORDINALITY AS e(x, i) WHERE i <= 60;
  RETURN json_build_object('conversation', v_conv, 'messages', v_rows,
    'nextBefore', CASE WHEN v_more THEN v_rows -> 0 ->> 'id' END);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_chat_conversation_delete(p_conversation_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  DELETE FROM citizen_ai_conversations WHERE id = p_conversation_id;
  IF NOT FOUND THEN PERFORM public.citizen_fail(404, 'Không tìm thấy hội thoại cần xóa'); END IF;
  RETURN json_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_chat_conversation_check(p_conversation_id uuid) RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM citizen_ai_conversations WHERE id = p_conversation_id) THEN
    PERFORM public.citizen_fail(404, 'Không tìm thấy cuộc trò chuyện của bạn');
  END IF;
  RETURN json_build_object('ok', true);
END $$;

-- Lưu câu hỏi và câu trả lời ĐÃ KIỂM TRA nguồn trong một giao dịch; p_conversation_id rỗng thì mở cuộc trò chuyện mới.
-- p_unanswered_topic: nhóm chủ đề (không phải nguyên văn câu hỏi) khi trợ lý không trả lời được, để thống kê.
CREATE OR REPLACE FUNCTION api.citizen_chat_save(p_conversation_id uuid, p_question text, p_answer text, p_mode text,
  p_sources jsonb DEFAULT '[]', p_suggestions jsonb DEFAULT '[]', p_notice text DEFAULT NULL, p_revision text DEFAULT NULL,
  p_unanswered_topic text DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_id uuid := p_conversation_id;
BEGIN
  PERFORM public.check_text(p_question, 'Câu hỏi', 1, 2000);
  IF v_id IS NOT NULL THEN
    PERFORM 1 FROM citizen_ai_conversations WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN PERFORM public.citizen_fail(404, 'Không tìm thấy cuộc trò chuyện của bạn'); END IF;
  ELSE
    INSERT INTO citizen_ai_conversations(citizen_id, tenant_id, title) VALUES (a.citizen_id, a.tenant_id, left(btrim(p_question), 100))
    RETURNING id INTO v_id;
  END IF;
  INSERT INTO citizen_ai_messages(conversation_id, citizen_id, tenant_id, role, content)
  VALUES (v_id, a.citizen_id, a.tenant_id, 'citizen', p_question);
  INSERT INTO citizen_ai_messages(conversation_id, citizen_id, tenant_id, role, content, mode, sources, suggestions, notice, revision)
  VALUES (v_id, a.citizen_id, a.tenant_id, 'assistant', p_answer, p_mode, coalesce(p_sources, '[]'), coalesce(p_suggestions, '[]'), p_notice, p_revision);
  IF p_mode = 'INSUFFICIENT' AND nullif(btrim(p_unanswered_topic), '') IS NOT NULL THEN
    INSERT INTO citizen_unanswered_topics(tenant_id, topic) VALUES (a.tenant_id, left(btrim(p_unanswered_topic), 200));
  END IF;
  UPDATE citizen_ai_conversations SET updated_at = now() WHERE id = v_id;
  RETURN json_build_object('conversationId', v_id);
END $$;

-- Mã các thủ tục xã của công dân đang mở (trợ lý chỉ trả lời trong phạm vi này).
CREATE OR REPLACE FUNCTION api.citizen_enabled_procedures() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN coalesce((SELECT json_agg(p.id ORDER BY p.id) FROM procedures p
                   WHERE p.published AND public.procedure_enabled_for(a.tenant_id, p.id)), '[]'::json);
END $$;

-- ===== 3. Quyền gọi =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['api.citizen_tickets(text, text, integer)', 'api.citizen_ticket(uuid)',
    'api.citizen_ticket_create(text, text, text, text)', 'api.citizen_ticket_reply(uuid, text)', 'api.citizen_feedback()',
    'api.citizen_feedback_create(text, text, text)', 'api.citizen_support_messages(text)', 'api.citizen_support_message_create(text, text)',
    'api.citizen_chat_conversations(integer)', 'api.citizen_chat_conversation(uuid, bigint)', 'api.citizen_chat_conversation_delete(uuid)',
    'api.citizen_chat_conversation_check(uuid)', 'api.citizen_chat_save(uuid, text, text, text, jsonb, jsonb, text, text, text)',
    'api.citizen_enabled_procedures()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
