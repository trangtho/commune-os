-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Nhật ký quản lý tài khoản: lãnh đạo đơn vị tạo, sửa, khóa, mở, cấp lại mật khẩu, xóa tài khoản cán bộ xử lý
-- (thao tác thật nằm ở Keycloak, qua dịch vụ core/accounts). Không lưu mật khẩu.
-- Chỉ thêm, không sửa, không xóa. Chạy lại nhiều lần không sao. Cần chạy sau 03-quy-trinh.sql.

CREATE TABLE IF NOT EXISTS staff_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_code text NOT NULL,
  actor text NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'lock', 'unlock', 'reset_password', 'delete', 'set_roles')),
  target_username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Máy đã tạo bảng bằng bản cũ (chỉ 4 thao tác): cập nhật ràng buộc cho đủ 6 thao tác.
ALTER TABLE staff_audit DROP CONSTRAINT IF EXISTS staff_audit_action_check;
ALTER TABLE staff_audit ADD CONSTRAINT staff_audit_action_check
  CHECK (action IN ('create', 'update', 'lock', 'unlock', 'reset_password', 'delete', 'set_roles'));

CREATE OR REPLACE FUNCTION public.staff_audit_block_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Nhật ký quản lý cán bộ chỉ được thêm, không được sửa hay xóa' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS staff_audit_no_change ON staff_audit;
CREATE TRIGGER staff_audit_no_change BEFORE UPDATE OR DELETE ON staff_audit
  FOR EACH ROW EXECUTE FUNCTION public.staff_audit_block_change();

-- Chỉ dịch vụ tài khoản gọi được (kèm khóa nội bộ X-Workflow-Token), bằng token của lãnh đạo.
CREATE OR REPLACE FUNCTION api.log_staff_action(action text, target_username text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Chỉ dịch vụ tài khoản của lõi được ghi nhật ký này' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(claims -> 'realm_access' -> 'roles', '[]'::jsonb) ? 'leader'
     OR coalesce(claims ->> 'tenant_id', '') = '' THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo xã được quản lý cán bộ' USING ERRCODE = '42501';
  END IF;
  INSERT INTO staff_audit (tenant_code, actor, action, target_username)
  VALUES (claims ->> 'tenant_id',
          coalesce(claims ->> 'preferred_username', claims ->> 'name', 'lãnh đạo'),
          log_staff_action.action, left(log_staff_action.target_username, 100));
END $$;

-- Lãnh đạo xem nhật ký xã mình; quản trị hệ thống xem tất cả.
DROP VIEW IF EXISTS api.staff_audit;
CREATE VIEW api.staff_audit AS
SELECT s.tenant_code, s.actor, s.action, s.target_username, s.created_at
FROM staff_audit s
WHERE s.tenant_code = nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id'
  AND coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'realm_access' -> 'roles', '[]'::jsonb) ? 'leader'
   OR coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'realm_access' -> 'roles', '[]'::jsonb) ? 'sys_admin';

REVOKE ALL ON FUNCTION api.log_staff_action(text, text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.staff_audit TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.log_staff_action(text, text) TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
