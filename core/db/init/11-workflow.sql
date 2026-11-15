-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Giao việc kiểm tra "bước chuyển hợp lệ" cho động cơ quy trình BPMN (Flowable).
-- Từ đây hàm set_dossier_status chỉ nhận lời gọi từ dịch vụ điều phối (core/orchestrator):
-- lời gọi phải kèm header X-Workflow-Token đúng bí mật. Gọi thẳng /rest/rpc/... bị từ chối (403).
-- Cơ sở dữ liệu vẫn tự kiểm tra: vai trò cán bộ, đúng xã tiếp nhận, lý do bắt buộc.
-- Chạy lại nhiều lần không lỗi.

-- Nơi giữ cấu hình nội bộ của lõi (chỉ lưu MÃ BĂM của bí mật). Không vai trò API nào đọc được.
CREATE TABLE IF NOT EXISTS core_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);
REVOKE ALL ON core_settings FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.is_workflow_call() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM core_settings s
     WHERE s.key = 'workflow_token_sha256'
       AND s.value = encode(sha256(convert_to(coalesce(
             nullif(current_setting('request.headers', true), '')::json ->> 'x-workflow-token', ''), 'UTF8')), 'hex'))
$$;

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
  -- 0. Chỉ dịch vụ điều phối quy trình được gọi hàm này.
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Đổi trạng thái hồ sơ phải đi qua động cơ quy trình (/workflow)' USING ERRCODE = '42501';
  END IF;

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

  -- 3. Trạng thái đích phải là một trạng thái hệ thống biết; bước chuyển do BPMN quyết định.
  IF status NOT IN ('processing', 'supplement', 'completed', 'rejected') THEN
    RAISE EXCEPTION 'Trạng thái "%" không hợp lệ', status USING ERRCODE = '22023';
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

-- Bảng bước chuyển cố định không còn dùng: sơ đồ BPMN là nguồn duy nhất.
DROP VIEW IF EXISTS api.dossier_transitions;
DROP TABLE IF EXISTS dossier_transitions;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT EXECUTE ON FUNCTION api.set_dossier_status(text, text, text) TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
