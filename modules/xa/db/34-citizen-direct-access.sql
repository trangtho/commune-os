-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Bước cuối khi chuyển Kênh người dân sang gọi lõi qua cổng APISIX:
--   1. tài khoản dịch vụ của client citizen-app (Keycloak, client_credentials) gọi lõi cho việc không có công dân
--      đăng nhập sẵn: liên kết đăng nhập OIDC bên ngoài với tài khoản công dân;
--   2. việc định kỳ (gửi nhắc việc, quét dữ liệu đến hạn rà soát lưu trữ) do dịch vụ điều phối của lõi gọi bằng khóa
--      nội bộ WORKFLOW_TOKEN, như cổng AI (public.is_workflow_call());
--   3. thu hồi mọi quyền đọc ghi dữ liệu của vai trò communeos_app (vai trò Kênh người dân dùng khi còn nối thẳng
--      PostgreSQL). Vai trò này chỉ còn kết nối để nhận tín hiệu thay đổi (LISTEN communeos_citizen_changes) cho thông báo
--      thời gian thực; LISTEN không cần quyền trên bảng nào.
-- Phải chạy sau mọi tệp còn GRANT cho communeos_app (các tệp trước vẫn cấp lại quyền mỗi lần db-setup chạy, và
-- 27-citizen-api-vault.sql chép các quyền đó sang citizen-app trước khi tệp này thu hồi). Chạy lại nhiều lần được.

-- ===== 1. Tài khoản dịch vụ của Kênh người dân =====
-- Token client_credentials của citizen-app: azp = citizen-app, preferred_username = service-account-citizen-app,
-- không có vai trò citizen (rest_pre_request không đặt biến công dân nào).
CREATE OR REPLACE FUNCTION public.is_citizen_service() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT public.jwt_claims() ->> 'azp' = 'citizen-app'
     AND public.jwt_claims() ->> 'preferred_username' = 'service-account-citizen-app'
     AND NOT coalesce(public.jwt_claims() -> 'realm_access' -> 'roles', '[]'::jsonb) ? 'citizen'
$$;

-- Liên kết người đã xác thực qua nhà cung cấp OIDC bên ngoài (Kênh người dân đã kiểm chữ ký ID token) với tài khoản
-- công dân; ghi địa phương cư trú và thông tin đã xác minh khi công dân đồng ý lúc đăng nhập. Không lưu ID token,
-- số định danh thô hay mã địa phương không khớp.
CREATE OR REPLACE FUNCTION api.citizen_service_oidc_link(p_login text, p_issuer text, p_residence_code text DEFAULT NULL,
  p_temporary_code text DEFAULT NULL, p_facts jsonb DEFAULT '{}') RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; v_residence uuid; v_temporary uuid; k text; v text;
BEGIN
  IF NOT public.is_citizen_service() THEN
    RAISE EXCEPTION 'Chỉ máy chủ Kênh người dân được gọi hàm này' USING ERRCODE = '42501';
  END IF;
  SELECT id, tenant_id, display_name INTO c FROM public.citizen_login_lookup(p_login);
  IF c.id IS NULL THEN
    PERFORM public.citizen_fail(403, 'Định danh đã xác thực nhưng chưa được liên kết tài khoản Công dân. Liên hệ quản trị viên Identity.');
  END IF;
  SELECT id INTO v_residence FROM tenants WHERE code = nullif(p_residence_code, '');
  SELECT id INTO v_temporary FROM tenants WHERE code = nullif(p_temporary_code, '');
  IF v_residence IS NOT NULL OR v_temporary IS NOT NULL THEN
    INSERT INTO citizen_service_preferences(citizen_id, tenant_id, residence_tenant_id, temporary_tenant_id, locality_source, locality_verified_at)
    VALUES (c.id, c.tenant_id, v_residence, v_temporary, 'oidc_verified', now())
    ON CONFLICT (citizen_id) DO UPDATE SET
      residence_tenant_id = coalesce(EXCLUDED.residence_tenant_id, citizen_service_preferences.residence_tenant_id),
      temporary_tenant_id = coalesce(EXCLUDED.temporary_tenant_id, citizen_service_preferences.temporary_tenant_id),
      locality_source = 'oidc_verified', locality_verified_at = now(), updated_at = now();
  END IF;
  IF jsonb_typeof(p_facts) = 'object' THEN
    FOR k, v IN SELECT key, value FROM jsonb_each_text(p_facts) LOOP
      CONTINUE WHEN k NOT IN ('fullName', 'birthDate', 'citizenIdentifier', 'phone', 'address') OR nullif(btrim(v), '') IS NULL;
      INSERT INTO citizen_verified_facts(citizen_id, tenant_id, field_key, field_value, source_issuer)
      VALUES (c.id, c.tenant_id, k, left(btrim(v), 200), left(coalesce(p_issuer, ''), 300))
      ON CONFLICT (citizen_id, field_key) DO UPDATE SET field_value = EXCLUDED.field_value,
        source_issuer = EXCLUDED.source_issuer, verified_at = now();
    END LOOP;
  END IF;
  RETURN json_build_object('id', c.id, 'tenant_id', c.tenant_id, 'display_name', c.display_name);
END $$;

-- ===== 2. Việc định kỳ (dịch vụ điều phối của lõi gọi, kèm X-Workflow-Token) =====
CREATE OR REPLACE FUNCTION api.system_dispatch_citizen_reminders() RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workflow_call() THEN RAISE EXCEPTION 'Chỉ dịch vụ của lõi được gọi hàm này' USING ERRCODE = 'PT403'; END IF;
  RETURN json_build_object('sent', public.citizen_dispatch_reminders(300));
END $$;

-- Chỉ tạo mục chờ lãnh đạo xã xem xét (ON CONFLICT DO NOTHING trong hàm quét), không xóa dữ liệu nào.
CREATE OR REPLACE FUNCTION api.system_scan_citizen_retention() RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; v_created int := 0; v_tenants int := 0;
BEGIN
  IF NOT public.is_workflow_call() THEN RAISE EXCEPTION 'Chỉ dịch vụ của lõi được gọi hàm này' USING ERRCODE = 'PT403'; END IF;
  FOR t IN SELECT id FROM tenants ORDER BY id LOOP
    v_tenants := v_tenants + 1;
    v_created := v_created + coalesce(public.citizen_staff_scan_retention(t.id), 0);
  END LOOP;
  RETURN json_build_object('tenants', v_tenants, 'created', v_created);
END $$;

-- ===== 3. Quyền =====
DO $$
DECLARE r record;
BEGIN
  REVOKE ALL ON FUNCTION api.citizen_service_oidc_link(text, text, text, text, jsonb) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION api.citizen_service_oidc_link(text, text, text, text, jsonb) TO "citizen-app";
  GRANT EXECUTE ON FUNCTION public.is_citizen_service() TO "citizen-app";
  REVOKE ALL ON FUNCTION api.system_dispatch_citizen_reminders(), api.system_scan_citizen_retention() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION api.system_dispatch_citizen_reminders(), api.system_scan_citizen_retention() TO web_anon;

  -- Thu hồi quyền dữ liệu của communeos_app: bảng, cột, chuỗi số, hàm (schema public và api).
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'communeos_app') THEN
    FOR r IN SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname IN ('public', 'api') AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
               AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) x WHERE x.grantee = 'communeos_app'::regrole) LOOP
      EXECUTE format('REVOKE ALL ON %I.%I FROM communeos_app', r.nspname, r.relname);
    END LOOP;
    FOR r IN SELECT n.nspname, c.relname, a.attname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname IN ('public', 'api') AND a.attnum > 0 AND NOT a.attisdropped
               AND EXISTS (SELECT 1 FROM aclexplode(a.attacl) x WHERE x.grantee = 'communeos_app'::regrole) LOOP
      EXECUTE format('REVOKE ALL (%I) ON %I.%I FROM communeos_app', r.attname, r.nspname, r.relname);
    END LOOP;
    FOR r IN SELECT n.nspname, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname IN ('public', 'api') AND c.relkind = 'S'
               AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) x WHERE x.grantee = 'communeos_app'::regrole) LOOP
      EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM communeos_app', r.nspname, r.relname);
    END LOOP;
    FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname IN ('public', 'api')
               AND EXISTS (SELECT 1 FROM aclexplode(p.proacl) x WHERE x.grantee = 'communeos_app'::regrole) LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM communeos_app', r.fn);
    END LOOP;
    REVOKE ALL ON SCHEMA api FROM communeos_app;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
