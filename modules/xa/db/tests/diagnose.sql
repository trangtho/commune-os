-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Non-destructive database diagnostics for the citizen channel.
SELECT current_database() AS database, current_user AS role_name,
  to_regclass('public.procedures') AS procedures_table,
  (SELECT count(*) FROM pg_roles WHERE rolname = 'citizen-app') AS citizen_api_role_count;
SELECT CASE WHEN to_regclass('public.procedures') IS NULL
  THEN 'MISSING_SCHEMA' ELSE 'SCHEMA_PRESENT' END AS schema_status;
DO $do$ BEGIN
  IF to_regclass('public.procedures') IS NOT NULL THEN
    RAISE NOTICE 'Published procedures: %', (SELECT count(*) FROM procedures WHERE published);
    -- Kênh người dân đọc ghi dữ liệu qua API của lõi (vai trò citizen-app); communeos_app chỉ còn nhận tín hiệu (LISTEN).
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='citizen-app') THEN
      RAISE NOTICE 'Citizen API role has procedures SELECT: %', has_table_privilege('citizen-app','public.procedures','SELECT');
    ELSE
      RAISE NOTICE 'Citizen API role citizen-app does not exist (run make repair-db)';
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='communeos_app') THEN
      RAISE NOTICE 'Listen-only role communeos_app has procedures SELECT (expected false): %', has_table_privilege('communeos_app','public.procedures','SELECT');
    END IF;
  END IF;
END $do$;
