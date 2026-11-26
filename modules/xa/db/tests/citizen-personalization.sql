-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
-- Run as DB admin: all test data and mutations roll back.
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
INSERT INTO citizen_service_preferences
  (citizen_id,tenant_id,personalization_enabled,audience_group,interest_categories)
VALUES
  (current_setting('demo.citizen_a')::uuid,current_setting('demo.tenant_a')::uuid,true,'parent',ARRAY['Hộ tịch']),
  (current_setting('demo.citizen_b')::uuid,current_setting('demo.tenant_b')::uuid,true,'business',ARRAY['Kinh doanh'])
ON CONFLICT(citizen_id) DO UPDATE SET
  audience_group=EXCLUDED.audience_group,interest_categories=EXCLUDED.interest_categories;

DO $$BEGIN
  IF has_table_privilege('citizen-app','citizen_procedure_receivers','INSERT') THEN
    RAISE EXCEPTION 'Citizen application role must not grant routing authority';
  END IF;
  IF has_table_privilege('citizen-app','procedure_recommendation_metadata','UPDATE') THEN
    RAISE EXCEPTION 'Citizen application role must not alter verified procedure metadata';
  END IF;
END$$;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM citizen_service_preferences;
  IF total <> 1 THEN RAISE EXCEPTION 'Citizen A must see only their own preferences: %', total; END IF;
  UPDATE citizen_service_preferences SET audience_group='other'
    WHERE citizen_id=current_setting('demo.citizen_b')::uuid;
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total <> 0 THEN RAISE EXCEPTION 'Citizen A must not update citizen B preference'; END IF;
  IF NOT EXISTS(SELECT 1 FROM citizen_service_preferences
      WHERE citizen_id=current_setting('demo.citizen_a')::uuid) THEN
    RAISE EXCEPTION 'Citizen A should see own row';
  END IF;
END$$;
SELECT set_config('app.citizen_id',current_setting('demo.citizen_b'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_b'),true);
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM citizen_service_preferences;
  IF total <> 1 THEN RAISE EXCEPTION 'Citizen B must see only their own preferences: %', total; END IF;
END$$;
RESET ROLE;
ROLLBACK;
SELECT 'Citizen personalization RLS test passed (all changes rolled back)' AS result;
