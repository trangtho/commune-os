-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Run as DB admin: all test data and mutations roll back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO citizen_service_preferences
  (citizen_id,tenant_id,personalization_enabled,audience_group,interest_categories)
VALUES
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true,'parent',ARRAY['Hộ tịch']),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',true,'business',ARRAY['Kinh doanh'])
ON CONFLICT(citizen_id) DO UPDATE SET
  audience_group=EXCLUDED.audience_group,interest_categories=EXCLUDED.interest_categories;

DO $$BEGIN
  IF has_table_privilege('communeos_app','citizen_procedure_receivers','INSERT') THEN
    RAISE EXCEPTION 'Citizen application role must not grant routing authority';
  END IF;
  IF has_table_privilege('communeos_app','procedure_recommendation_metadata','UPDATE') THEN
    RAISE EXCEPTION 'Citizen application role must not alter verified procedure metadata';
  END IF;
END$$;
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM citizen_service_preferences;
  IF total <> 1 THEN RAISE EXCEPTION 'Citizen A must see only their own preferences: %', total; END IF;
  UPDATE citizen_service_preferences SET audience_group='other'
    WHERE citizen_id='20000000-0000-4000-8000-000000000002';
  GET DIAGNOSTICS total=ROW_COUNT;
  IF total <> 0 THEN RAISE EXCEPTION 'Citizen A must not update citizen B preference'; END IF;
  IF NOT EXISTS(SELECT 1 FROM citizen_service_preferences
      WHERE citizen_id='20000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Citizen A should see own row';
  END IF;
END$$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM citizen_service_preferences;
  IF total <> 1 THEN RAISE EXCEPTION 'Citizen B must see only their own preferences: %', total; END IF;
END$$;
RESET ROLE;
ROLLBACK;
SELECT 'Citizen personalization RLS test passed (all changes rolled back)' AS result;
