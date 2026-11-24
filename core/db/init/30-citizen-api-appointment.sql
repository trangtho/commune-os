-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API của lõi cho lịch hẹn của Kênh người dân: đặt lượt tại bộ phận một cửa và đặt lịch tư vấn. Gọi qua cổng APISIX
-- (POST /rest/rpc/<tên hàm>) bằng token Keycloak của công dân; SECURITY INVOKER, RLS theo công dân.
-- Khung giờ do cán bộ công bố (api.publish_counter_slot), không có lịch trống tự sinh. Các hàm đặt / hủy dùng lại
-- hàm sẵn có của lõi (citizen_book_counter_slot, citizen_cancel_counter_booking, citizen_cancel_consultation).
-- Chạy lại nhiều lần được.

-- ===== 1. Lượt tại bộ phận một cửa =====
CREATE OR REPLACE FUNCTION api.citizen_counter_slots(p_procedure_id text DEFAULT '') RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object('publishedOnly', true, 'items', coalesce((SELECT json_agg(x ORDER BY x.starts_at) FROM (
    SELECT s.id, s.procedure_id, p.title AS procedure_title, s.tenant_id, t.name AS locality_name, s.starts_at, s.ends_at,
      s.capacity, s.serving_ticket_no, public.citizen_counter_slot_remaining(s.id) AS remaining
    FROM citizen_counter_slots s JOIN procedures p ON p.id = s.procedure_id AND p.published
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.published AND s.starts_at > now() + interval '1 hour' AND s.starts_at < now() + interval '31 days'
      AND (coalesce(p_procedure_id, '') = '' OR s.procedure_id = left(btrim(p_procedure_id), 100))
    ORDER BY s.starts_at LIMIT 80) x WHERE x.remaining > 0), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_counter_bookings() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object('items', coalesce((SELECT json_agg(x ORDER BY x.starts_at DESC, x.created_at DESC) FROM (
    SELECT b.id, b.procedure_id, p.title AS procedure_title, b.ticket_number, b.status, b.created_at,
      s.starts_at, s.ends_at, s.serving_ticket_no, t.name AS locality_name
    FROM citizen_counter_bookings b JOIN citizen_counter_slots s ON s.id = b.slot_id
    JOIN procedures p ON p.id = b.procedure_id JOIN tenants t ON t.id = s.tenant_id
    ORDER BY s.starts_at DESC, b.created_at DESC LIMIT 100) x), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_counter_book(p_slot_id uuid) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN public.citizen_book_counter_slot(p_slot_id);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_counter_booking_cancel(p_booking_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT coalesce(public.citizen_cancel_counter_booking(p_booking_id), false) THEN
    PERFORM public.citizen_fail(409, 'Lịch hẹn không thể hủy hoặc không thuộc tài khoản');
  END IF;
  RETURN json_build_object('ok', true);
END $$;

-- ===== 2. Lịch tư vấn =====
CREATE OR REPLACE FUNCTION api.citizen_consultations() RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  RETURN json_build_object('items', coalesce((SELECT json_agg(x ORDER BY x.created_at DESC) FROM (
    SELECT id, category, subject, description, channel, contact_phone, preferred_at, slot_id, status, meeting_url,
      staff_note, created_at, updated_at
    FROM citizen_consultation_requests ORDER BY created_at DESC LIMIT 50) x), '[]'::json));
END $$;

CREATE OR REPLACE FUNCTION api.citizen_consultation_slots(p_category text DEFAULT '') RETURNS json
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); v_category text := left(btrim(coalesce(p_category, '')), 80);
BEGIN
  RETURN json_build_object('officiallyPublished', true, 'items', coalesce((SELECT json_agg(x ORDER BY x.starts_at) FROM (
    SELECT s.id, s.category, s.starts_at, s.ends_at, public.citizen_slot_remaining(s.id) AS remaining
    FROM citizen_consultation_slots s
    WHERE s.is_published AND s.starts_at > now() + interval '1 hour' AND s.starts_at < now() + interval '31 days'
      AND (v_category = '' OR s.category = v_category)
    ORDER BY s.starts_at LIMIT 60) x WHERE x.remaining > 0), '[]'::json));
END $$;

-- Thông tin liên hệ, nội dung đã được Kênh người dân kiểm tra; lõi kiểm tra lại thời gian, giới hạn, lĩnh vực, khung giờ.
CREATE OR REPLACE FUNCTION api.citizen_consultation_create(p_category text, p_subject text, p_description text, p_channel text,
  p_contact_phone text, p_preferred_at timestamptz, p_slot_id uuid DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor(); s record; v_row record;
BEGIN
  PERFORM public.check_text(p_category, 'Lĩnh vực', 2, 80), public.check_text(p_subject, 'Tiêu đề', 5, 150),
    public.check_text(p_description, 'Nội dung', 10, 2000), public.check_text(p_contact_phone, 'Số điện thoại', 9, 15);
  IF p_channel NOT IN ('phone', 'online') THEN PERFORM public.citizen_fail(400, 'Hình thức tư vấn không hợp lệ'); END IF;
  IF p_preferred_at IS NULL OR p_preferred_at < now() + interval '1 hour' OR p_preferred_at > now() + interval '31 days' THEN
    PERFORM public.citizen_fail(422, 'Vui lòng chọn thời gian từ 1 giờ đến 31 ngày tới');
  END IF;
  IF (SELECT count(*) FROM citizen_consultation_requests WHERE status IN ('pending', 'confirmed') AND preferred_at > now()) >= 3 THEN
    PERFORM public.citizen_fail(429, 'Bạn đang có 3 lịch tư vấn chưa kết thúc');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM procedures WHERE published AND category = btrim(p_category)) THEN
    PERFORM public.citizen_fail(422, 'Lĩnh vực tư vấn không có trong danh mục');
  END IF;
  IF p_slot_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_slot_id::text));
    SELECT id, category, starts_at INTO s FROM citizen_consultation_slots
    WHERE id = p_slot_id AND is_published AND starts_at > now() + interval '1 hour' AND starts_at < now() + interval '31 days';
    IF s.id IS NULL OR s.category <> btrim(p_category) OR abs(extract(epoch FROM s.starts_at - p_preferred_at)) > 1 THEN
      PERFORM public.citizen_fail(409, 'Khung giờ đã thay đổi hoặc không phù hợp');
    END IF;
    IF public.citizen_slot_remaining(p_slot_id) <= 0 THEN
      PERFORM public.citizen_fail(409, 'Khung giờ đã hết lượt đăng ký; vui lòng chọn thời gian khác');
    END IF;
  END IF;
  INSERT INTO citizen_consultation_requests(citizen_id, tenant_id, category, subject, description, channel, contact_phone, preferred_at, slot_id)
  VALUES (a.citizen_id, a.tenant_id, btrim(p_category), btrim(p_subject), btrim(p_description), p_channel, btrim(p_contact_phone),
    p_preferred_at, p_slot_id)
  RETURNING id, status, preferred_at INTO v_row;
  RETURN row_to_json(v_row);
END $$;

CREATE OR REPLACE FUNCTION api.citizen_consultation_cancel(p_request_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record := public.citizen_actor();
BEGIN
  IF NOT coalesce(public.citizen_cancel_consultation(p_request_id), false) THEN
    PERFORM public.citizen_fail(404, 'Không có lịch hẹn có thể hủy');
  END IF;
  RETURN json_build_object('ok', true);
END $$;

-- ===== 3. Quyền gọi =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['api.citizen_counter_slots(text)', 'api.citizen_counter_bookings()', 'api.citizen_counter_book(uuid)',
    'api.citizen_counter_booking_cancel(uuid)', 'api.citizen_consultations()', 'api.citizen_consultation_slots(text)',
    'api.citizen_consultation_create(text, text, text, text, text, timestamptz, uuid)', 'api.citizen_consultation_cancel(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO "citizen-app"', f);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
