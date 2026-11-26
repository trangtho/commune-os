-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Khởi tạo tài khoản theo vai trò:
--   * Quản trị hệ thống (tài khoản duy nhất có sẵn, đặt trong .env) tạo xã kèm tài khoản lãnh đạo xã, qua dịch vụ
--     tài khoản của lõi (POST /accounts/tenants). Tạo tài khoản lỗi thì xã vừa tạo bị hủy (api.remove_new_tenant).
--   * Lãnh đạo xã tạo cán bộ (giữ như cũ, POST /accounts/staff).
--   * Người dân tự đăng ký (POST /public/accounts/register): dịch vụ tài khoản tạo dòng citizens qua
--     api.system_register_citizen (khóa nội bộ X-Workflow-Token), rồi tạo tài khoản Keycloak vai trò citizen gắn
--     citizen_id; lỗi thì hủy dòng vừa tạo (api.system_unregister_citizen).
-- Chạy lại nhiều lần được.

-- ===== 1. Bảng =====
-- Thời điểm người dân đồng ý xử lý dữ liệu cá nhân khi đăng ký (Nghị định 13/2023/NĐ-CP).
ALTER TABLE citizens ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz;
-- Mật khẩu do Keycloak giữ; cột cũ chỉ còn để tương thích.
ALTER TABLE citizens ALTER COLUMN password_hash SET DEFAULT '';

-- Hủy đơn vị vừa tạo (api.remove_new_tenant) thuộc lõi (core/db/init/02-don-vi.sql).

-- ===== 3. Đăng ký công dân (chỉ dịch vụ tài khoản của lõi gọi, kèm X-Workflow-Token) =====
-- Xã đang hoạt động (đơn vị đã bật gói xã) để người dân chọn khi đăng ký (công khai).
CREATE OR REPLACE FUNCTION api.public_registration_tenants() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(json_build_object('code', code, 'name', name) ORDER BY name), '[]'::json)
  FROM tenants WHERE status = 'active' AND public.tenant_has_module(id, 'xa')   -- chỉ đơn vị dùng gói xã
$$;

-- Tạo hồ sơ công dân. Dịch vụ tài khoản đã kiểm tra dữ liệu và sự đồng ý; hàm kiểm tra lại các ràng buộc chính.
CREATE OR REPLACE FUNCTION api.system_register_citizen(p_tenant_code text, p_login_name text, p_display_name text,
  p_email text DEFAULT NULL, p_phone text DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_id uuid := gen_random_uuid();
BEGIN
  IF NOT public.is_workflow_call() THEN RAISE EXCEPTION 'Chỉ dịch vụ của lõi được gọi hàm này' USING ERRCODE = 'PT403'; END IF;
  SELECT id INTO v_tenant FROM tenants WHERE code = p_tenant_code AND status = 'active'
    AND public.tenant_has_module(id, 'xa');
  IF v_tenant IS NULL THEN PERFORM public.citizen_fail(422, 'Xã cư trú không hợp lệ hoặc đang tạm khóa'); END IF;
  IF coalesce(p_login_name, '') !~ '^[a-z0-9][a-z0-9._-]{2,49}$' THEN PERFORM public.citizen_fail(400, 'Tên đăng nhập không hợp lệ'); END IF;
  IF length(btrim(coalesce(p_display_name, ''))) NOT BETWEEN 2 AND 100 THEN PERFORM public.citizen_fail(400, 'Họ tên từ 2 đến 100 ký tự'); END IF;
  IF nullif(btrim(p_email), '') IS NULL AND nullif(btrim(p_phone), '') IS NULL THEN
    PERFORM public.citizen_fail(400, 'Cần email hoặc số điện thoại');
  END IF;
  IF EXISTS (SELECT 1 FROM citizens WHERE login_name = p_login_name) THEN
    PERFORM public.citizen_fail(409, 'Tên đăng nhập đã được dùng');
  END IF;
  INSERT INTO citizens(id, tenant_id, login_name, display_name, email, phone, password_hash, privacy_consent_at)
  VALUES (v_id, v_tenant, p_login_name, btrim(p_display_name), nullif(lower(btrim(p_email)), ''), nullif(btrim(p_phone), ''), '', now());
  INSERT INTO citizen_data_access_events(citizen_id, tenant_id, action, purpose, processing_unit, resource_kind, resource_reference, actor_kind)
  VALUES (v_id, v_tenant, 'privacy_consent_registration', 'Đồng ý xử lý dữ liệu cá nhân khi đăng ký tài khoản',
    'Cổng công dân CommuneOS', 'account', p_login_name, 'citizen');
  RETURN json_build_object('citizen_id', v_id, 'tenant_code', p_tenant_code);
END $$;

-- Hủy hồ sơ vừa tạo khi tạo tài khoản Keycloak lỗi (chỉ hồ sơ chưa có hoạt động, tạo trong vòng 1 giờ).
CREATE OR REPLACE FUNCTION api.system_unregister_citizen(p_citizen_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workflow_call() THEN RAISE EXCEPTION 'Chỉ dịch vụ của lõi được gọi hàm này' USING ERRCODE = 'PT403'; END IF;
  -- Nhật ký sử dụng dữ liệu là chuỗi không sửa được (trigger citizen_data_immutable); hủy đăng ký chỉ áp dụng khi
  -- công dân chưa có hồ sơ nào, và giữ lại nhật ký: đánh dấu tên đăng nhập đã hủy để dùng lại được.
  IF EXISTS (SELECT 1 FROM applications WHERE citizen_id = p_citizen_id) THEN
    PERFORM public.citizen_fail(409, 'Công dân đã có hồ sơ, không hủy được');
  END IF;
  UPDATE citizens SET login_name = 'huy-' || id::text, display_name = 'Đăng ký không hoàn tất', email = NULL, phone = NULL
  WHERE id = p_citizen_id AND created_at > now() - interval '1 hour';
  RETURN json_build_object('ok', FOUND);
END $$;

-- ===== 4. Quyền =====
DO $$
BEGIN
  REVOKE ALL ON FUNCTION api.public_registration_tenants(),
    api.system_register_citizen(text, text, text, text, text), api.system_unregister_citizen(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION api.public_registration_tenants() TO web_anon, "citizen-app";
  GRANT EXECUTE ON FUNCTION api.system_register_citizen(text, text, text, text, text), api.system_unregister_citizen(uuid) TO web_anon;
END $$;

NOTIFY pgrst, 'reload schema';
