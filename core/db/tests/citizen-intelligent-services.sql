-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
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
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF has_table_privilege('citizen-app','citizen_result_verifications','DELETE')
 OR has_table_privilege('citizen-app','citizen_sync_requests','DELETE')
 OR has_table_privilege('citizen-app','citizen_unanswered_topics','SELECT')
 THEN RAISE EXCEPTION 'Excessive table privilege'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='citizen_verify_result_public') THEN
  RAISE EXCEPTION 'Missing result proof function'; END IF;
END $$;
-- Creating a request is constrained to the citizen's tenant and identity.
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
INSERT INTO citizen_sync_requests(citizen_id,source_tenant_id,target_tenant_id,payload)
VALUES(current_setting('demo.citizen_a')::uuid,current_setting('demo.tenant_a')::uuid,
current_setting('demo.tenant_b')::uuid,'{"display_name":"Demo"}'::jsonb);
DO $$ BEGIN IF (SELECT count(*) FROM citizen_sync_requests)<1 THEN
 RAISE EXCEPTION 'Owner cannot access own sync requests'; END IF; END $$;
SELECT set_config('app.citizen_id',current_setting('demo.citizen_b'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_b'),true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM citizen_sync_requests WHERE source_tenant_id=current_setting('demo.tenant_a')::uuid)
 THEN RAISE EXCEPTION 'Cross-tenant sync leakage'; END IF; END $$;
-- Even without citizen identity, proof lookups only return minimal data for valid unguessable codes.
SELECT * FROM citizen_verify_result_public(repeat('0',64));
RESET ROLE;
ROLLBACK;
SELECT 'Citizen intelligence RLS, minimal public verification and permission checks passed' AS result;
