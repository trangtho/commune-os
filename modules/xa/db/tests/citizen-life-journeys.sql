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
 IF has_table_privilege('citizen-app','citizen_life_journeys','DELETE')
 OR has_table_privilege('citizen-app','citizen_reminder_deliveries','INSERT')
 OR has_table_privilege('citizen-app','citizen_friction_events','SELECT')
 THEN RAISE EXCEPTION 'Citizen role has excessive workflow privileges'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='citizen_dispatch_reminders')
 THEN RAISE EXCEPTION 'Reminder dispatcher missing'; END IF;
END $$;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
INSERT INTO citizen_life_journeys(citizen_id,tenant_id,title,event_code,situation)
VALUES(current_setting('demo.citizen_a')::uuid,current_setting('demo.tenant_a')::uuid,
 'Thử lộ trình địa phương','birth','Tôi vừa sinh con');
INSERT INTO citizen_life_journey_items(journey_id,citizen_id,tenant_id,procedure_id,position)
SELECT id,current_setting('demo.citizen_a')::uuid,current_setting('demo.tenant_a')::uuid,'khai-sinh',1
 FROM citizen_life_journeys WHERE title='Thử lộ trình địa phương';
INSERT INTO citizen_personal_tasks(citizen_id,tenant_id,title,due_on)
VALUES(current_setting('demo.citizen_a')::uuid,current_setting('demo.tenant_a')::uuid,
 'Chuẩn bị giấy tờ thử nghiệm',CURRENT_DATE+1);
INSERT INTO citizen_reminder_settings(citizen_id,tenant_id,enabled,days_before)
VALUES(current_setting('demo.citizen_a')::uuid,current_setting('demo.tenant_a')::uuid,true,2)
ON CONFLICT(citizen_id) DO UPDATE SET enabled=true,days_before=2;
DO $$ BEGIN
 IF (SELECT count(*) FROM citizen_life_journeys WHERE title='Thử lộ trình địa phương')<>1
 OR (SELECT count(*) FROM citizen_life_journey_items i JOIN citizen_life_journeys j ON j.id=i.journey_id WHERE j.title='Thử lộ trình địa phương')<>1
 THEN RAISE EXCEPTION 'Cannot see own plan'; END IF;
END $$;
SELECT set_config('app.citizen_id',current_setting('demo.citizen_b'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_b'),true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM citizen_life_journeys WHERE title='Thử lộ trình địa phương')
 OR EXISTS(SELECT 1 FROM citizen_personal_tasks WHERE title='Chuẩn bị giấy tờ thử nghiệm')
 THEN RAISE EXCEPTION 'Cross-tenant plan or reminder leak'; END IF;
END $$;
RESET ROLE;
-- Scheduled jobs use SECURITY DEFINER and idempotent delivery tracking.
SELECT citizen_dispatch_reminders(300);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM citizen_reminder_deliveries d
  JOIN citizen_personal_tasks t ON d.reminder_key LIKE 'task:'||t.id||':%'
  WHERE t.title='Chuẩn bị giấy tờ thử nghiệm')
 THEN RAISE EXCEPTION 'Reminder not queued'; END IF;
END $$;
SELECT citizen_dispatch_reminders(300);
DO $$ BEGIN
 IF (SELECT count(*) FROM citizen_reminder_deliveries d
  JOIN citizen_personal_tasks t ON d.reminder_key LIKE 'task:'||t.id||':%'
  WHERE t.title='Chuẩn bị giấy tờ thử nghiệm')<>1
 THEN RAISE EXCEPTION 'Duplicate reminder'; END IF;
END $$;
ROLLBACK;
SELECT 'Life journey, reminder and RLS checks passed (rolled back)' AS result;
