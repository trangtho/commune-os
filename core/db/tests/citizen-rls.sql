-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Run using postgres database owner: psql -v ON_ERROR_STOP=1 -f core/db/tests/citizen-rls.sql
-- This script switches into the non-superuser application role.
BEGIN;
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
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
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
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
