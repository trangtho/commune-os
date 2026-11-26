-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Thông báo cho cán bộ xã. Lõi tự sinh thông báo khi có sự kiện (trigger), màn hình cán bộ đọc qua
-- cổng API (/rest/staff_notifications) bằng token của cán bộ; RLS chỉ cho thấy thông báo của xã mình,
-- gửi cho mình hoặc cho vai trò của mình. Trạng thái đã đọc lưu riêng từng cán bộ.
-- Chạy lại nhiều lần được.

CREATE TABLE IF NOT EXISTS staff_notifications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code        text NOT NULL,
  recipient_staff_id text,            -- NULL: gửi cho mọi cán bộ của xã (lọc thêm theo vai trò nếu có)
  recipient_role     text CHECK (recipient_role IN ('leader', 'officer')),
  category           text NOT NULL,
  title              text NOT NULL,
  body               text NOT NULL DEFAULT '',
  dossier_id         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_notifications_tenant_idx ON staff_notifications (tenant_code, created_at DESC);
-- Một thông báo cho mỗi sự kiện (dùng khi nạp lại thông báo cho hồ sơ đang chờ, không tạo trùng).
CREATE UNIQUE INDEX IF NOT EXISTS staff_notifications_once_idx
  ON staff_notifications (category, dossier_id, coalesce(recipient_staff_id, ''))
  WHERE category IN ('ho-so-moi', 'duoc-giao');

CREATE TABLE IF NOT EXISTS staff_notification_reads (
  notification_id uuid NOT NULL REFERENCES staff_notifications(id) ON DELETE CASCADE,
  staff_id        text NOT NULL,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, staff_id)
);

-- ===== Quyền xem =====
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_notification_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_notifications_read ON staff_notifications;
CREATE POLICY staff_notifications_read ON staff_notifications FOR SELECT TO "commune-app"
  USING (tenant_code = public.current_tenant_code()
     AND public.current_staff_id() IS NOT NULL
     AND (public.has_role('leader') OR public.has_role('officer') OR public.has_role('receptionist'))
     AND EXISTS (SELECT 1 FROM tenants t WHERE t.code = tenant_code AND t.status = 'active')
     AND (recipient_staff_id IS NULL OR recipient_staff_id = public.current_staff_id())
     AND (recipient_role IS NULL OR public.has_role(recipient_role)));
DROP POLICY IF EXISTS staff_notification_reads_own ON staff_notification_reads;
CREATE POLICY staff_notification_reads_own ON staff_notification_reads FOR ALL TO "commune-app"
  USING (staff_id = public.current_staff_id()) WITH CHECK (staff_id = public.current_staff_id());
GRANT SELECT ON staff_notifications TO "commune-app";
GRANT SELECT, INSERT ON staff_notification_reads TO "commune-app";

-- ===== API cho màn hình cán bộ =====
CREATE OR REPLACE VIEW api.staff_notifications WITH (security_invoker = true) AS
SELECT n.id, n.dossier_id AS application_id, n.title, n.body, n.category, n.created_at,
       EXISTS (SELECT 1 FROM staff_notification_reads r
               WHERE r.notification_id = n.id AND r.staff_id = public.current_staff_id()) AS is_read
FROM staff_notifications n;
GRANT SELECT ON api.staff_notifications TO "commune-app";

CREATE OR REPLACE FUNCTION api.read_staff_notification(notification_id uuid) RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.require_staff();
  INSERT INTO staff_notification_reads (notification_id, staff_id)
  SELECT n.id, public.current_staff_id() FROM staff_notifications n WHERE n.id = read_staff_notification.notification_id
  ON CONFLICT DO NOTHING;
  RETURN json_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION api.read_all_staff_notifications() RETURNS json
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  PERFORM public.require_staff();
  INSERT INTO staff_notification_reads (notification_id, staff_id)
  SELECT n.id, public.current_staff_id() FROM staff_notifications n
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('ok', true, 'marked', v_count);
END $$;

-- Lãnh đạo xã gửi thông báo tới từng công dân của xã mình.
CREATE OR REPLACE FUNCTION api.broadcast_citizen_notice(title text, body text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_leader(); v_count int;
BEGIN
  IF length(btrim(coalesce(title, ''))) NOT BETWEEN 3 AND 150 OR length(btrim(coalesce(body, ''))) NOT BETWEEN 3 AND 2000 THEN
    RAISE EXCEPTION 'Tiêu đề từ 3 đến 150 ký tự, nội dung từ 3 đến 2000 ký tự' USING ERRCODE = '22023';
  END IF;
  INSERT INTO citizen_notifications (citizen_id, tenant_id, title, body, category)
  SELECT c.id, c.tenant_id, btrim(title), btrim(body), 'broadcast'
  FROM citizens c JOIN tenants t ON t.id = c.tenant_id WHERE t.code = v_code;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO staff_notifications (tenant_code, category, title, body)
  VALUES (v_code, 'thong-bao-cong-dan', 'Đã gửi thông báo tới ' || v_count || ' công dân',
          public.current_staff_name() || ': ' || btrim(title));
  RETURN json_build_object('ok', true, 'sent', v_count);
END $$;

REVOKE ALL ON FUNCTION api.read_staff_notification(uuid), api.read_all_staff_notifications(),
  api.broadcast_citizen_notice(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION api.read_staff_notification(uuid), api.read_all_staff_notifications(),
  api.broadcast_citizen_notice(text, text) TO "commune-app";

-- ===== Sinh thông báo từ sự kiện =====
CREATE OR REPLACE FUNCTION public.staff_notice_on_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT ap.id, ap.assigned_staff_id, t.code AS tenant_code, p.title AS procedure_title
  INTO a FROM applications ap
  JOIN tenants t ON t.id = coalesce(ap.receiving_tenant_id, ap.tenant_id)
  JOIN procedures p ON p.id = ap.procedure_id
  WHERE ap.id = NEW.application_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.event_type = 'submitted' THEN
    INSERT INTO staff_notifications (tenant_code, category, title, body, dossier_id)
    VALUES (a.tenant_code, 'ho-so-moi', 'Hồ sơ mới ' || a.id, a.procedure_title || ': chờ tiếp nhận và phân công.', a.id)
    ON CONFLICT DO NOTHING;
  ELSIF NEW.event_type = 'assigned' AND a.assigned_staff_id IS NOT NULL THEN
    INSERT INTO staff_notifications (tenant_code, recipient_staff_id, category, title, body, dossier_id)
    VALUES (a.tenant_code, a.assigned_staff_id, 'duoc-giao', 'Bạn được giao hồ sơ ' || a.id, a.procedure_title, a.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS staff_notice_on_event ON application_events;
CREATE TRIGGER staff_notice_on_event AFTER INSERT ON application_events
  FOR EACH ROW EXECUTE FUNCTION public.staff_notice_on_event();

-- Hồ sơ hết cần bổ sung, quay lại xử lý: báo cán bộ được giao (chưa giao thì cả xã).
CREATE OR REPLACE FUNCTION public.staff_notice_on_supplement() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'supplement' AND NEW.status = 'processing' THEN
    INSERT INTO staff_notifications (tenant_code, recipient_staff_id, category, title, body, dossier_id)
    SELECT t.code, NEW.assigned_staff_id, 'bo-sung', 'Hồ sơ ' || NEW.id || ' đã được bổ sung',
           'Hồ sơ chuyển lại bước xử lý.', NEW.id
    FROM tenants t WHERE t.id = coalesce(NEW.receiving_tenant_id, NEW.tenant_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS staff_notice_on_supplement ON applications;
CREATE TRIGGER staff_notice_on_supplement AFTER UPDATE OF status ON applications
  FOR EACH ROW EXECUTE FUNCTION public.staff_notice_on_supplement();

-- Yêu cầu của cán bộ: báo lãnh đạo khi có yêu cầu mới, báo người gửi khi được duyệt hoặc từ chối.
CREATE OR REPLACE FUNCTION public.staff_notice_on_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind text := CASE NEW.kind WHEN 'dossier_approval' THEN 'trình duyệt hồ sơ' WHEN 'profile_update' THEN 'sửa hồ sơ cá nhân'
  WHEN 'document_add' THEN 'thêm giấy tờ' WHEN 'document_remove' THEN 'gỡ giấy tờ' ELSE 'yêu cầu khác' END;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO staff_notifications (tenant_code, recipient_role, category, title, body, dossier_id)
    VALUES (NEW.tenant_code, 'leader', 'yeu-cau', 'Yêu cầu mới: ' || v_kind, coalesce(NEW.staff_name, 'Cán bộ') ||
            CASE WHEN NEW.dossier_id IS NOT NULL THEN ', hồ sơ ' || NEW.dossier_id ELSE '' END, NEW.dossier_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO staff_notifications (tenant_code, recipient_staff_id, category, title, body, dossier_id)
    VALUES (NEW.tenant_code, NEW.staff_id, 'yeu-cau',
            CASE WHEN NEW.status = 'approved' THEN 'Đã duyệt: ' ELSE 'Bị từ chối: ' END || v_kind,
            coalesce(NEW.decided_note, ''), NEW.dossier_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS staff_notice_on_request ON staff_requests;
CREATE TRIGGER staff_notice_on_request AFTER INSERT OR UPDATE OF status ON staff_requests
  FOR EACH ROW EXECUTE FUNCTION public.staff_notice_on_request();

-- Hồ sơ đang chờ tiếp nhận từ trước khi có bảng này: tạo thông báo một lần (không trùng nhờ chỉ mục).
INSERT INTO staff_notifications (tenant_code, category, title, body, dossier_id, created_at)
SELECT t.code, 'ho-so-moi', 'Hồ sơ mới ' || ap.id, p.title || ': chờ tiếp nhận và phân công.', ap.id, coalesce(ap.submitted_at, now())
FROM applications ap
JOIN tenants t ON t.id = coalesce(ap.receiving_tenant_id, ap.tenant_id)
JOIN procedures p ON p.id = ap.procedure_id
WHERE ap.status = 'submitted'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
