-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Gói nghiệp vụ bật cho từng đơn vị. Một gói đã cài (core_modules) chỉ phục vụ đơn vị đã bật gói đó:
-- xã A bật gói "xa", Công ty A bật gói "doanh-nghiep". Gói tự kiểm tra trong RLS và hàm của mình bằng
-- public.tenant_has_module() / public.require_module(). Gói bị gỡ khỏi COMMUNEOS_MODULES thì coi như tắt ở mọi đơn vị.
-- Chỉ quản trị hệ thống bật, tắt (api.set_tenant_module; dịch vụ tài khoản gọi khi tạo đơn vị).
-- Chạy lại nhiều lần không lỗi.

CREATE TABLE IF NOT EXISTS tenant_modules (
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module     text NOT NULL CHECK (module ~ '^[a-z][a-z0-9-]{0,62}$'),
  enabled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module)
);
REVOKE ALL ON tenant_modules FROM PUBLIC;

-- Đơn vị có dùng gói này không (gói phải đang được cài).
CREATE OR REPLACE FUNCTION public.tenant_has_module(p_tenant uuid, p_module text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM tenant_modules tm JOIN core_modules m ON m.name = tm.module
                  WHERE tm.tenant_id = p_tenant AND tm.module = p_module)
$$;

-- Đơn vị của người gọi (theo token) có dùng gói này không.
CREATE OR REPLACE FUNCTION public.module_enabled(p_module text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM tenants t WHERE t.code = public.current_tenant_code() AND t.status = 'active'
                   AND public.tenant_has_module(t.id, p_module))
$$;

-- Như require_staff(), thêm điều kiện đơn vị đã bật gói. Trả mã đơn vị.
CREATE OR REPLACE FUNCTION public.require_module(p_module text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_staff();
BEGIN
  IF NOT public.module_enabled(p_module) THEN
    RAISE EXCEPTION 'Đơn vị chưa bật gói nghiệp vụ %', p_module USING ERRCODE = '42501';
  END IF;
  RETURN v_code;
END $$;

-- ===== API =====
-- Gói của từng đơn vị: quản trị hệ thống thấy mọi đơn vị, người của đơn vị chỉ thấy đơn vị mình.
DROP VIEW IF EXISTS api.tenant_modules;
CREATE VIEW api.tenant_modules AS
SELECT t.code AS tenant_code, tm.module, m.title, tm.enabled_at
FROM tenant_modules tm
JOIN tenants t ON t.id = tm.tenant_id
JOIN core_modules m ON m.name = tm.module
WHERE public.is_sys_admin() OR t.code = public.current_tenant_code()
ORDER BY t.code, tm.module;

-- Gói của đơn vị người gọi, ví dụ ["xa"]. Ứng dụng của một gói dùng để từ chối đơn vị không dùng gói đó.
CREATE OR REPLACE FUNCTION api.my_modules() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(json_agg(tm.module ORDER BY tm.module), '[]'::json)
  FROM tenants t JOIN tenant_modules tm ON tm.tenant_id = t.id JOIN core_modules m ON m.name = tm.module
  WHERE t.code = public.current_tenant_code() AND t.status = 'active'
$$;

-- Bật / tắt một gói cho một đơn vị (chỉ sys_admin). Chỉ bật được gói đang được cài.
-- Tắt gói không xóa dữ liệu của gói; bật lại thì thấy lại.
CREATE OR REPLACE FUNCTION api.set_tenant_module(tenant_code text, module text, enabled boolean) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid;
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được bật, tắt gói cho đơn vị' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_tenant FROM tenants WHERE code = set_tenant_module.tenant_code;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đơn vị %', tenant_code USING ERRCODE = 'P0002';
  END IF;
  IF enabled IS NULL THEN
    RAISE EXCEPTION 'Thiếu enabled (true/false)' USING ERRCODE = '22023';
  END IF;
  IF enabled THEN
    IF NOT EXISTS (SELECT 1 FROM core_modules WHERE name = set_tenant_module.module) THEN
      RAISE EXCEPTION 'Gói % chưa được cài (COMMUNEOS_MODULES)', module USING ERRCODE = '22023';
    END IF;
    INSERT INTO tenant_modules (tenant_id, module) VALUES (v_tenant, set_tenant_module.module)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM tenant_modules tm WHERE tm.tenant_id = v_tenant AND tm.module = set_tenant_module.module;
  END IF;
  RETURN json_build_object('tenant_code', tenant_code, 'module', module, 'enabled', enabled);
END $$;
REVOKE ALL ON FUNCTION api.set_tenant_module(text, text, boolean), api.my_modules(),
  public.require_module(text) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.tenant_modules TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.set_tenant_module(text, text, boolean), api.my_modules(),
      public.require_module(text) TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
