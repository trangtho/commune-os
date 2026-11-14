-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Non-destructive database diagnostics for the citizen channel.
SELECT current_database() AS database, current_user AS role_name,
  to_regclass('public.procedures') AS procedures_table,
  (SELECT count(*) FROM pg_roles WHERE rolname = 'communeos_app') AS app_role_count;
SELECT CASE WHEN to_regclass('public.procedures') IS NULL
  THEN 'MISSING_SCHEMA' ELSE 'SCHEMA_PRESENT' END AS schema_status;
DO $do$ BEGIN
  IF to_regclass('public.procedures') IS NOT NULL THEN
    RAISE NOTICE 'Published procedures: %', (SELECT count(*) FROM procedures WHERE published);
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='communeos_app') THEN
      RAISE NOTICE 'App role has table SELECT: %', has_table_privilege('communeos_app','public.procedures','SELECT');
    ELSE
      RAISE NOTICE 'App role communeos_app does not exist';
    END IF;
  END IF;
END $do$;
