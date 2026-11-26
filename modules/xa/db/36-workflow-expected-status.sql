-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Bảo toàn điều kiện trạng thái khi hai cán bộ cùng xử lý. Giữ nguyên quyền RPC hiện có.
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
  v_expected text := nullif(current_setting('request.headers', true), '')::json ->> 'x-workflow-expected-status';
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

  IF v_expected IS NOT NULL AND v_expected <> v_app.status THEN
    RAISE EXCEPTION 'Trạng thái hồ sơ đã thay đổi; vui lòng tải lại' USING ERRCODE = 'PT409';
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


NOTIFY pgrst, 'reload schema';
