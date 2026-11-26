-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Đơn vị (tenant) và các hàm đọc token: nền của lõi, mọi gói nghiệp vụ dùng chung.
-- Đơn vị là một xã, một công ty... Token Keycloak có claim tenant_id = mã đơn vị (ví dụ "xa-a", "cong-ty-a");
-- PostgREST ghi token vào request.jwt.claims; chính sách RLS của từng gói lọc theo mã đơn vị đó.
-- Chạy lại nhiều lần không lỗi.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS api;

-- ===== 1. Bảng đơn vị =====
CREATE TABLE IF NOT EXISTS tenants (
  id   uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'locked'));

-- ===== 2. Hàm đọc token =====
-- Mã đơn vị của người gọi. Không có token → NULL → không thấy gì.
CREATE OR REPLACE FUNCTION public.current_tenant_code() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::json ->> 'tenant_id'
$$;

-- Người gọi có vai trò sys_admin (quản trị hệ thống) trong Keycloak không.
CREATE OR REPLACE FUNCTION public.is_sys_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb
       -> 'realm_access' -> 'roles') ? 'sys_admin', false)
$$;

CREATE OR REPLACE FUNCTION public.jwt_claims() RETURNS jsonb
LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

-- Người đăng nhập được nhận diện bằng `sub` của token Keycloak.
CREATE OR REPLACE FUNCTION public.current_staff_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT public.jwt_claims() ->> 'sub' $$;

CREATE OR REPLACE FUNCTION public.current_staff_name() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(public.jwt_claims() ->> 'name', public.jwt_claims() ->> 'preferred_username', 'Cán bộ') $$;

CREATE OR REPLACE FUNCTION public.has_role(p_role text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(public.jwt_claims() -> 'realm_access' -> 'roles', '[]'::jsonb) ? p_role $$;

-- Người của một đơn vị đang hoạt động (bất kỳ vai trò nào trong đơn vị). Trả mã đơn vị.
CREATE OR REPLACE FUNCTION public.require_staff() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.current_tenant_code();
BEGIN
  IF v_code IS NULL OR public.current_staff_id() IS NULL
     OR NOT (public.has_role('receptionist') OR public.has_role('officer') OR public.has_role('leader'))
     OR NOT EXISTS (SELECT 1 FROM tenants WHERE code = v_code AND status = 'active') THEN
    RAISE EXCEPTION 'Chỉ cán bộ của đơn vị đang hoạt động được dùng chức năng này' USING ERRCODE = '42501';
  END IF;
  RETURN v_code;
END $$;

-- Lãnh đạo của đơn vị (vai trò leader). Trả mã đơn vị.
CREATE OR REPLACE FUNCTION public.require_leader() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := public.require_staff();
BEGIN
  IF NOT public.has_role('leader') THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo đơn vị được dùng chức năng này' USING ERRCODE = '42501';
  END IF;
  RETURN v_code;
END $$;

-- Che bớt số điện thoại: chỉ giữ 2 số đầu và 2 số cuối.
CREATE OR REPLACE FUNCTION public.mask_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p IS NULL OR length(p) < 5 THEN p
    ELSE left(p, 2) || repeat('*', length(p) - 4) || right(p, 2) END
$$;

-- ===== 3. API đơn vị =====
-- Quản trị hệ thống thấy mọi đơn vị, người của đơn vị chỉ thấy đơn vị mình.
-- Gói nghiệp vụ được tạo lại bảng ảo này với cột thống kê riêng ở cuối (ví dụ gói xã thêm dossier_count).
DROP VIEW IF EXISTS api.tenants;
CREATE VIEW api.tenants AS
SELECT t.id, t.code, t.name, t.status, t.created_at
FROM tenants t
WHERE public.is_sys_admin() OR t.code = public.current_tenant_code()
ORDER BY t.code;

CREATE OR REPLACE FUNCTION api.add_tenant(code text, name text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tenants;
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được thêm đơn vị' USING ERRCODE = '42501';
  END IF;
  IF code IS NULL OR code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Mã đơn vị chỉ gồm chữ thường không dấu, số và dấu gạch ngang' USING ERRCODE = '22023';
  END IF;
  IF name IS NULL OR btrim(name) = '' THEN
    RAISE EXCEPTION 'Vui lòng nhập tên đơn vị' USING ERRCODE = '22023';
  END IF;
  INSERT INTO tenants (id, code, name) VALUES (gen_random_uuid(), code, btrim(name))
  RETURNING * INTO r;
  RETURN row_to_json(r);
END $$;

CREATE OR REPLACE FUNCTION api.set_tenant_status(code text, status text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tenants;
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được khóa/mở đơn vị' USING ERRCODE = '42501';
  END IF;
  UPDATE tenants t SET status = set_tenant_status.status
   WHERE t.code = set_tenant_status.code RETURNING * INTO r;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đơn vị %', code USING ERRCODE = 'P0002';
  END IF;
  RETURN row_to_json(r);
END $$;

-- Hủy đơn vị vừa tạo khi tạo tài khoản lãnh đạo lỗi (dịch vụ tài khoản gọi).
-- Chỉ đơn vị tạo trong vòng 1 giờ và chưa có dữ liệu nào tham chiếu (khóa ngoại ON DELETE CASCADE thì xóa theo).
CREATE OR REPLACE FUNCTION api.remove_new_tenant(p_code text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được hủy đơn vị' USING ERRCODE = '42501';
  END IF;
  DELETE FROM tenants WHERE code = p_code AND created_at > now() - interval '1 hour';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chỉ hủy được đơn vị vừa tạo trong vòng 1 giờ' USING ERRCODE = 'PT409';
  END IF;
  RETURN json_build_object('removed', p_code);
EXCEPTION WHEN foreign_key_violation THEN
  RAISE EXCEPTION 'Đơn vị đã có dữ liệu, không hủy được' USING ERRCODE = 'PT409';
END $$;

REVOKE ALL ON FUNCTION api.add_tenant(text, text), api.set_tenant_status(text, text),
  api.remove_new_tenant(text) FROM PUBLIC;

-- ===== 4. Quyền =====
-- "commune-app": người của đơn vị (cán bộ, lãnh đạo, quản trị hệ thống). Vai trò tạo ở 01-create-api-roles.sh.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT USAGE ON SCHEMA api, public TO "commune-app";
    GRANT SELECT ON api.tenants, tenants TO "commune-app";
    GRANT EXECUTE ON FUNCTION public.current_tenant_code(), public.is_sys_admin(), public.mask_phone(text),
      public.jwt_claims(), public.current_staff_id(), public.current_staff_name(), public.has_role(text),
      public.require_staff(), public.require_leader(),
      api.add_tenant(text, text), api.set_tenant_status(text, text), api.remove_new_tenant(text) TO "commune-app";
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
    GRANT USAGE ON SCHEMA api TO web_anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
