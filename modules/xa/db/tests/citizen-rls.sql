-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
-- Run using postgres database owner: psql -v ON_ERROR_STOP=1 -f core/db/tests/citizen-rls.sql
-- This script switches into the non-superuser application role.
-- Xã và công dân mẫu do make demo tạo (mã ngẫu nhiên theo từng bản cài): xa-a, xa-b, congdan.demo, congdan.khac.
DO $demo$ BEGIN
  IF (SELECT count(*) FROM tenants WHERE code IN ('xa-a','xa-b')) < 2
     OR (SELECT count(*) FROM citizens WHERE login_name IN ('congdan.demo','congdan.khac')) < 2 THEN
    RAISE EXCEPTION 'Chưa có dữ liệu mẫu: chạy make demo trước khi kiểm thử';
  END IF;
  PERFORM set_config('demo.tenant_a', (SELECT id::text FROM tenants WHERE code = 'xa-a'), false),
          set_config('demo.tenant_b', (SELECT id::text FROM tenants WHERE code = 'xa-b'), false),
          set_config('demo.citizen_a', (SELECT id::text FROM citizens WHERE login_name = 'congdan.demo'), false),
          set_config('demo.citizen_b', (SELECT id::text FROM citizens WHERE login_name = 'congdan.khac'), false);
END $demo$;
BEGIN;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM applications WHERE id='HS-2026-001248') THEN
   RAISE EXCEPTION 'RLS: tài khoản A không thấy hồ sơ của mình';
 END IF;
 IF EXISTS (SELECT 1 FROM applications WHERE id='HS-2026-008888') THEN
   RAISE EXCEPTION 'RLS: rò rỉ dữ liệu hồ sơ từ xã B';
 END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_b'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_b'),true);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM applications WHERE id='HS-2026-008888') THEN
   RAISE EXCEPTION 'RLS: tài khoản B không thấy hồ sơ của mình';
 END IF;
 IF EXISTS (SELECT 1 FROM applications WHERE id='HS-2026-001248') THEN
   RAISE EXCEPTION 'RLS: rò rỉ dữ liệu hồ sơ từ xã A';
 END IF;
END $$;
ROLLBACK;
