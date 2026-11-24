-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
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
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
INSERT INTO citizen_life_journeys(citizen_id,tenant_id,title,event_code,situation)
VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 'Thử lộ trình địa phương','birth','Tôi vừa sinh con');
INSERT INTO citizen_life_journey_items(journey_id,citizen_id,tenant_id,procedure_id,position)
SELECT id,'20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','khai-sinh',1
 FROM citizen_life_journeys WHERE title='Thử lộ trình địa phương';
INSERT INTO citizen_personal_tasks(citizen_id,tenant_id,title,due_on)
VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 'Chuẩn bị giấy tờ thử nghiệm',CURRENT_DATE+1);
INSERT INTO citizen_reminder_settings(citizen_id,tenant_id,enabled,days_before)
VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true,2)
ON CONFLICT(citizen_id) DO UPDATE SET enabled=true,days_before=2;
DO $$ BEGIN
 IF (SELECT count(*) FROM citizen_life_journeys WHERE title='Thử lộ trình địa phương')<>1
 OR (SELECT count(*) FROM citizen_life_journey_items i JOIN citizen_life_journeys j ON j.id=i.journey_id WHERE j.title='Thử lộ trình địa phương')<>1
 THEN RAISE EXCEPTION 'Cannot see own plan'; END IF;
END $$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
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
