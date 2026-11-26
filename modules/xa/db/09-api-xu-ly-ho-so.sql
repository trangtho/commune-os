-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API ghi cho cán bộ xã: đổi trạng thái hồ sơ.
-- Gọi: POST /rest/rpc/set_dossier_status
--      {"dossier_id":"HS-2026-001176","status":"processing","note":"..."}
--
-- Hàm tự kiểm tra 4 điều, giao diện không bỏ qua được (Poka-yoke):
--   1. Người gọi là cán bộ (receptionist / officer / leader) của một xã đang hoạt động.
--   2. Hồ sơ được nộp về đúng xã của người gọi; xã khác → báo "không tồn tại".
--   3. Bước chuyển trạng thái hợp lệ (bảng bên dưới).
--   4. Yêu cầu bổ sung hoặc từ chối thì bắt buộc ghi lý do.
-- Mỗi lần đổi trạng thái tự ghi lịch sử và gửi thông báo cho người dân.
-- Chạy lại nhiều lần không lỗi.

-- Các bước chuyển trạng thái được phép.
CREATE TABLE IF NOT EXISTS dossier_transitions (
  from_status text NOT NULL,
  to_status   text NOT NULL,
  PRIMARY KEY (from_status, to_status)
);
INSERT INTO dossier_transitions (from_status, to_status) VALUES
  ('submitted',  'processing'),   -- tiếp nhận xong, chuyển xử lý
  ('submitted',  'supplement'),   -- thiếu giấy tờ ngay từ đầu
  ('submitted',  'rejected'),
  ('processing', 'supplement'),
  ('processing', 'completed'),
  ('processing', 'rejected'),
  ('supplement', 'processing'),   -- người dân đã bổ sung
  ('supplement', 'rejected')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION api.set_dossier_status(dossier_id text, status text, note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claims   jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_tenant tenants;
  v_app    applications;
  v_actor  text;
  v_note   text := nullif(btrim(coalesce(note, '')), '');
  v_label  text;
BEGIN
  -- 1. Người gọi phải là cán bộ của một xã đang hoạt động.
  IF NOT (coalesce(claims -> 'realm_access' -> 'roles', '[]'::jsonb)
          ?| array['receptionist', 'officer', 'leader']) THEN
    RAISE EXCEPTION 'Chỉ cán bộ xã được xử lý hồ sơ' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tenant FROM tenants t WHERE t.code = claims ->> 'tenant_id';
  IF v_tenant.id IS NULL OR v_tenant.status <> 'active' THEN
    RAISE EXCEPTION 'Xã của bạn đang bị khóa hoặc không tồn tại' USING ERRCODE = '42501';
  END IF;

  -- 2. Hồ sơ phải nộp về xã của người gọi. Khóa dòng để 2 cán bộ không sửa cùng lúc.
  SELECT * INTO v_app FROM applications a
   WHERE a.id = set_dossier_status.dossier_id
     AND coalesce(a.receiving_tenant_id, a.tenant_id) = v_tenant.id
     AND a.status <> 'draft'
   FOR UPDATE;
  IF v_app.id IS NULL THEN
    RAISE EXCEPTION 'Hồ sơ không tồn tại' USING ERRCODE = 'PT404';
  END IF;

  -- 3. Bước chuyển phải hợp lệ.
  IF NOT EXISTS (SELECT 1 FROM dossier_transitions d
                  WHERE d.from_status = v_app.status
                    AND d.to_status = set_dossier_status.status) THEN
    RAISE EXCEPTION 'Không thể chuyển hồ sơ từ "%" sang "%"', v_app.status, status
      USING ERRCODE = 'PT409';
  END IF;

  -- 4. Bổ sung / từ chối phải có lý do.
  IF status IN ('supplement', 'rejected') AND v_note IS NULL THEN
    RAISE EXCEPTION 'Vui lòng ghi lý do khi yêu cầu bổ sung hoặc từ chối' USING ERRCODE = '22023';
  END IF;

  v_actor := coalesce(claims ->> 'name', claims ->> 'preferred_username', 'Cán bộ');
  v_label := CASE status
    WHEN 'processing' THEN 'Hồ sơ đang được xử lý'
    WHEN 'supplement' THEN 'Hồ sơ cần bổ sung giấy tờ'
    WHEN 'completed'  THEN 'Hồ sơ đã có kết quả'
    WHEN 'rejected'   THEN 'Hồ sơ bị từ chối'
  END;

  UPDATE applications a
     SET status = set_dossier_status.status,
         updated_at = now(),
         result_note = CASE WHEN set_dossier_status.status IN ('completed', 'rejected')
                            THEN coalesce(v_note, a.result_note) ELSE a.result_note END
   WHERE a.id = v_app.id;

  INSERT INTO application_events (application_id, event_type, note, actor_name)
  VALUES (v_app.id, status, coalesce(v_note, v_label), v_actor);

  INSERT INTO citizen_notifications (citizen_id, tenant_id, application_id, title, body, category)
  VALUES (v_app.citizen_id, v_app.tenant_id, v_app.id, v_label,
          coalesce(v_note, v_label || ' (' || v_app.id || ').'), 'case');

  RETURN json_build_object('id', v_app.id, 'status', status, 'previous_status', v_app.status);
END $$;

REVOKE ALL ON FUNCTION api.set_dossier_status(text, text, text) FROM PUBLIC;

-- Bảng bước chuyển cũng đọc được qua API để giao diện chỉ hiện nút hợp lệ.
DROP VIEW IF EXISTS api.dossier_transitions;
CREATE VIEW api.dossier_transitions AS
SELECT from_status, to_status FROM dossier_transitions;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT EXECUTE ON FUNCTION api.set_dossier_status(text, text, text) TO "commune-app";
    GRANT SELECT ON api.dossier_transitions TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';