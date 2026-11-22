-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Công dân gọi API dữ liệu qua cổng APISIX (/rest) bằng token Keycloak của client "citizen-app".
--   Keycloak → token (azp = citizen-app, vai trò citizen, citizen_id, citizen_tenant)
--   → PostgREST chuyển sang vai trò "citizen-app"
--   → rest_pre_request() đặt app.citizen_id, app.tenant_id
--   → các chính sách RLS sẵn có của bảng công dân áp dụng như khi Kênh người dân nối trực tiếp.
-- Chạy lại nhiều lần được.

-- ===== 1. Vai trò PostgREST của công dân =====
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'citizen-app') THEN
    CREATE ROLE "citizen-app" NOLOGIN;
  END IF;
  IF NOT pg_has_role('authenticator', 'citizen-app', 'MEMBER') THEN
    GRANT "citizen-app" TO authenticator;
  END IF;
END $$;

GRANT USAGE ON SCHEMA api TO "citizen-app";

-- ===== 2. Ánh xạ token công dân sang biến RLS =====
-- PostgREST gọi hàm này đầu mỗi yêu cầu (PGRST_DB_PRE_REQUEST), sau khi đã kiểm chữ ký token.
-- Chỉ token của client citizen-app có vai trò citizen mới được đặt biến; citizen_id phải trùng
-- một công dân thật thuộc đúng xã ghi trong token. Sai bất kỳ điều kiện nào: không đặt gì,
-- RLS không trả dòng nào. Token cán bộ (commune-app) đi qua mà không bị ảnh hưởng.
CREATE OR REPLACE FUNCTION public.rest_pre_request() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c        jsonb := public.jwt_claims();
  v_id     uuid;
  v_tenant uuid;
BEGIN
  IF c ->> 'azp' IS DISTINCT FROM 'citizen-app'
     OR NOT coalesce(c -> 'realm_access' -> 'roles', '[]'::jsonb) ? 'citizen' THEN
    RETURN;
  END IF;
  BEGIN
    v_id := (c ->> 'citizen_id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN;
  END;
  SELECT ci.tenant_id INTO v_tenant
  FROM citizens ci JOIN tenants t ON t.id = ci.tenant_id
  WHERE ci.id = v_id AND t.code = c ->> 'citizen_tenant';
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;
  PERFORM set_config('app.citizen_id', v_id::text, true),
          set_config('app.tenant_id', v_tenant::text, true);
END $$;

REVOKE ALL ON FUNCTION public.rest_pre_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rest_pre_request() TO "commune-app", "citizen-app";

-- ===== 3. API cho công dân =====
-- Thông tin của chính công dân đang đăng nhập. RLS của bảng citizens chỉ trả đúng một dòng.
CREATE OR REPLACE VIEW api.my_citizen_profile WITH (security_invoker = true) AS
SELECT c.id, c.login_name, c.display_name, c.email, c.phone, c.address,
       c.tenant_id, t.code AS tenant_code, t.name AS tenant_name
FROM citizens c
JOIN tenants t ON t.id = c.tenant_id;

GRANT SELECT (id, tenant_id, login_name, display_name, email, phone, address) ON citizens TO "citizen-app";
GRANT SELECT (id, code, name) ON tenants TO "citizen-app";
GRANT SELECT ON api.my_citizen_profile TO "citizen-app";

-- Báo PostgREST nạp lại danh sách API khi chạy trên hệ thống đang hoạt động.
NOTIFY pgrst, 'reload schema';
