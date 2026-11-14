-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- API dữ liệu của lõi (PostgREST đọc schema "api", đi sau cổng APISIX).
-- Cách ly xã nằm ở CƠ SỞ DỮ LIỆU (RLS), không chỉ ở giao diện:
--   token Keycloak có claim tenant_id = mã xã (vd "xa-a")
--   PostgREST ghi token vào request.jwt.claims
--   chính sách RLS chỉ trả về hồ sơ có tenants.code = tenant_id.
-- Chạy lại nhiều lần không lỗi.

-- ===== 1. Bổ sung cột cho bảng xã (trạng thái khóa/mở, ngày tạo) =====
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('active', 'locked'));

-- ===== 2. Hàm đọc thông tin từ token =====
-- Mã xã của người gọi. Không có token → NULL → không thấy gì.
CREATE OR REPLACE FUNCTION public.current_tenant_code() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::json ->> 'tenant_id'
$$;

-- Người gọi có vai trò sys_admin trong Keycloak không.
CREATE OR REPLACE FUNCTION public.is_sys_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb
       -> 'realm_access' -> 'roles') ? 'sys_admin', false)
$$;

-- Che bớt số điện thoại: chỉ giữ 2 số đầu và 2 số cuối.
CREATE OR REPLACE FUNCTION public.mask_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p IS NULL OR length(p) < 5 THEN p
    ELSE left(p, 2) || repeat('*', length(p) - 4) || right(p, 2) END
$$;

-- ===== 3. Chính sách RLS cho cán bộ (vai trò "commune-app") =====
-- Chỉ thấy hồ sơ của xã mình, và xã phải đang hoạt động (xã bị khóa → không thấy gì).
-- Chính sách của Kênh người dân (app.citizen_id) giữ nguyên.
DROP POLICY IF EXISTS staff_tenant_policy ON applications;
CREATE POLICY staff_tenant_policy ON applications FOR SELECT TO "commune-app"
  USING (tenant_id = (SELECT t.id FROM tenants t
                      WHERE t.code = public.current_tenant_code() AND t.status = 'active'));

DROP POLICY IF EXISTS staff_tenant_policy ON application_events;
CREATE POLICY staff_tenant_policy ON application_events FOR SELECT TO "commune-app"
  USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_id));

-- ===== 4. Schema api: những gì giao diện được thấy =====
CREATE SCHEMA IF NOT EXISTS api;

-- Hồ sơ của xã. security_invoker: chạy bằng quyền người gọi nên RLS luôn áp dụng.
DROP VIEW IF EXISTS api.dossiers;
CREATE VIEW api.dossiers WITH (security_invoker = true) AS
SELECT a.id, t.code AS tenant_code, a.procedure_id, p.title AS procedure_title,
       a.status, a.applicant_name,
       public.mask_phone(a.applicant_phone) AS applicant_phone,
       a.submitted_at, a.due_at,
       (a.due_at IS NOT NULL AND a.due_at < CURRENT_DATE
         AND a.status NOT IN ('completed', 'rejected')) AS overdue
FROM applications a
JOIN tenants t ON t.id = a.tenant_id
JOIN procedures p ON p.id = a.procedure_id
WHERE a.status <> 'draft';

DROP VIEW IF EXISTS api.dossier_events;
CREATE VIEW api.dossier_events WITH (security_invoker = true) AS
SELECT e.application_id AS dossier_id, e.event_type, e.note, e.actor_name, e.created_at
FROM application_events e;

DROP VIEW IF EXISTS api.procedures;
CREATE VIEW api.procedures WITH (security_invoker = true) AS
SELECT id, title, category, sla_days, fee_note FROM procedures WHERE published;

-- Danh sách xã: quản trị hệ thống thấy tất cả, cán bộ chỉ thấy xã mình.
-- dossier_count chỉ là con số tổng hợp, không lộ nội dung hồ sơ.
-- View này chạy bằng quyền chủ sở hữu (không security_invoker) để đếm được hồ sơ.
DROP VIEW IF EXISTS api.tenants;
CREATE VIEW api.tenants AS
SELECT t.id, t.code, t.name, t.status, t.created_at,
       (SELECT count(*) FROM applications a
         WHERE a.tenant_id = t.id AND a.status <> 'draft') AS dossier_count
FROM tenants t
WHERE public.is_sys_admin() OR t.code = public.current_tenant_code()
ORDER BY t.code;

-- ===== 5. Hàm ghi (chỉ sys_admin) — gọi bằng POST /rest/rpc/<tên hàm> =====
CREATE OR REPLACE FUNCTION api.add_tenant(code text, name text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r tenants;
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được thêm xã' USING ERRCODE = '42501';
  END IF;
  IF code IS NULL OR code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Mã xã chỉ gồm chữ thường không dấu, số và dấu gạch ngang' USING ERRCODE = '22023';
  END IF;
  IF name IS NULL OR btrim(name) = '' THEN
    RAISE EXCEPTION 'Vui lòng nhập tên xã' USING ERRCODE = '22023';
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
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được khóa/mở xã' USING ERRCODE = '42501';
  END IF;
  UPDATE tenants t SET status = set_tenant_status.status
   WHERE t.code = set_tenant_status.code RETURNING * INTO r;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy xã %', code USING ERRCODE = 'P0002';
  END IF;
  RETURN row_to_json(r);
END $$;

REVOKE ALL ON FUNCTION api.add_tenant(text, text), api.set_tenant_status(text, text) FROM PUBLIC;

-- ===== 6. Quyền =====
-- "commune-app" chỉ đọc các view trong api và gọi 2 hàm trên; không đọc được schema khác qua API.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT USAGE ON SCHEMA api, public TO "commune-app";
    GRANT SELECT ON api.dossiers, api.dossier_events, api.procedures, api.tenants TO "commune-app";
    -- Bảng gốc cần SELECT vì view chạy bằng quyền người gọi; RLS vẫn lọc theo xã.
    GRANT SELECT ON applications, application_events, tenants, procedures TO "commune-app";
    GRANT EXECUTE ON FUNCTION public.current_tenant_code(), public.is_sys_admin(),
      public.mask_phone(text), api.add_tenant(text, text),
      api.set_tenant_status(text, text) TO "commune-app";
  END IF;
END $$;

-- Báo PostgREST nạp lại cấu trúc khi chạy lại script trên hệ thống đang chạy.
NOTIFY pgrst, 'reload schema';