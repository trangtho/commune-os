-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Vai trò do gói nghiệp vụ khai báo (mục "roles" trong modules/<gói>/module.json), ví dụ gói doanh nghiệp có
-- "doanh-nghiep:truong-phong". core/db/migrate.sh ghi danh sách khi cài gói; identity-setup tạo vai trò cùng tên trong
-- Keycloak. Lãnh đạo đơn vị gán cho nhân viên qua dịch vụ tài khoản (PUT /accounts/staff/:id/roles), chỉ vai trò của
-- gói đơn vị đã bật. Gói kiểm tra vai trò bằng public.has_role('<gói>:<vai trò>') như mọi vai trò khác.
-- Chạy lại nhiều lần không lỗi.

CREATE TABLE IF NOT EXISTS core_module_roles (
  module      text NOT NULL CHECK (module ~ '^[a-z][a-z0-9-]{0,62}$'),
  name        text NOT NULL CHECK (name ~ '^[a-z][a-z0-9-]{0,40}$'),
  title       text NOT NULL,
  description text,
  PRIMARY KEY (module, name)
);
REVOKE ALL ON core_module_roles FROM PUBLIC;

-- Đồng bộ vai trò của một gói theo module.json (thêm, sửa tên hiển thị, gỡ vai trò không còn khai báo).
CREATE OR REPLACE FUNCTION public.module_roles_sync(p_module text, p_roles json) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO core_module_roles (module, name, title, description)
  SELECT p_module, r ->> 'name', coalesce(r ->> 'title', r ->> 'name'), r ->> 'description'
  FROM json_array_elements(coalesce(p_roles, '[]'::json)) r
  ON CONFLICT (module, name) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;
  DELETE FROM core_module_roles m WHERE m.module = p_module
    AND m.name NOT IN (SELECT r ->> 'name' FROM json_array_elements(coalesce(p_roles, '[]'::json)) r);
  SELECT count(*) INTO v_count FROM core_module_roles WHERE module = p_module;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.module_roles_sync(text, json) FROM PUBLIC;

-- Vai trò gán được: quản trị hệ thống thấy vai trò của mọi gói đã cài; người của đơn vị thấy vai trò của gói đơn vị
-- mình đã bật. role là tên trong Keycloak và trong token: "<gói>:<vai trò>".
DROP VIEW IF EXISTS api.module_roles;
CREATE VIEW api.module_roles AS
SELECT r.module || ':' || r.name AS role, r.module, r.name, r.title, r.description
FROM core_module_roles r JOIN core_modules m ON m.name = r.module
WHERE public.is_sys_admin() OR public.module_enabled(r.module)
ORDER BY r.module, r.name;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.module_roles TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
