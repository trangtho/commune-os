-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Incremental, idempotent migration. Demo advisory data is never promoted to a legal source.
CREATE TABLE IF NOT EXISTS citizen_life_journeys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 120),
 situation text NOT NULL DEFAULT '' CHECK(length(situation)<=500),
 event_code text NOT NULL DEFAULT 'other' CHECK(event_code IN ('birth','marriage','residence','business','loss','other')),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citizen_life_journeys_owner ON citizen_life_journeys(citizen_id,updated_at DESC);
ALTER TABLE citizen_life_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_life_journeys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_life_journeys_owner_rls ON citizen_life_journeys;
CREATE POLICY citizen_life_journeys_owner_rls ON citizen_life_journeys FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE TABLE IF NOT EXISTS citizen_life_journey_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),journey_id uuid NOT NULL REFERENCES citizen_life_journeys(id) ON DELETE CASCADE,
 citizen_id uuid NOT NULL REFERENCES citizens(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 procedure_id text NOT NULL REFERENCES procedures(id),position smallint NOT NULL CHECK(position BETWEEN 1 AND 8),
 state text NOT NULL DEFAULT 'todo' CHECK(state IN ('todo','in_progress','done','skipped')),
 application_id text REFERENCES applications(id) ON DELETE SET NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(journey_id,procedure_id),UNIQUE(journey_id,position)
);
CREATE INDEX IF NOT EXISTS citizen_life_journey_items_owner ON citizen_life_journey_items(citizen_id,journey_id);
ALTER TABLE citizen_life_journey_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_life_journey_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_life_journey_items_owner_rls ON citizen_life_journey_items;
CREATE POLICY citizen_life_journey_items_owner_rls ON citizen_life_journey_items FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM citizen_life_journeys j WHERE j.id=journey_id AND j.citizen_id=citizen_life_journey_items.citizen_id AND j.tenant_id=citizen_life_journey_items.tenant_id))
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM citizen_life_journeys j WHERE j.id=journey_id AND j.citizen_id=citizen_life_journey_items.citizen_id AND j.tenant_id=citizen_life_journey_items.tenant_id));

-- User-selected alerts only. No email, SMS, or background collection by default.
CREATE TABLE IF NOT EXISTS citizen_reminder_settings (
 citizen_id uuid PRIMARY KEY REFERENCES citizens(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 enabled boolean NOT NULL DEFAULT false,days_before smallint NOT NULL DEFAULT 2 CHECK(days_before BETWEEN 0 AND 14),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE citizen_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_reminder_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_reminder_settings_owner ON citizen_reminder_settings;
CREATE POLICY citizen_reminder_settings_owner ON citizen_reminder_settings FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE TABLE IF NOT EXISTS citizen_personal_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),citizen_id uuid NOT NULL REFERENCES citizens(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 title text NOT NULL CHECK(length(title) BETWEEN 3 AND 140),due_on date NOT NULL,
 application_id text REFERENCES applications(id) ON DELETE SET NULL,
 completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(due_on BETWEEN DATE '2000-01-01' AND DATE '2100-12-31')
);
CREATE INDEX IF NOT EXISTS citizen_personal_tasks_owner ON citizen_personal_tasks(citizen_id,due_on);
ALTER TABLE citizen_personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_personal_tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_personal_tasks_owner_rls ON citizen_personal_tasks;
CREATE POLICY citizen_personal_tasks_owner_rls ON citizen_personal_tasks FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE TABLE IF NOT EXISTS citizen_reminder_deliveries (
 citizen_id uuid NOT NULL REFERENCES citizens(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 reminder_key text NOT NULL,delivered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(citizen_id,reminder_key)
);
ALTER TABLE citizen_reminder_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_reminder_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_reminder_deliveries_owner ON citizen_reminder_deliveries;
CREATE POLICY citizen_reminder_deliveries_owner ON citizen_reminder_deliveries FOR SELECT
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

-- Server-side, non-sensitive progress cursor. Contents remain in the existing server-side draft.
CREATE TABLE IF NOT EXISTS citizen_draft_cursors (
 application_id text PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
 citizen_id uuid NOT NULL REFERENCES citizens(id),tenant_id uuid NOT NULL REFERENCES tenants(id),
 step smallint NOT NULL DEFAULT 1 CHECK(step BETWEEN 1 AND 3),revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE citizen_draft_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_draft_cursors FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_draft_cursors_owner ON citizen_draft_cursors;
CREATE POLICY citizen_draft_cursors_owner ON citizen_draft_cursors FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

-- Opt-in telemetry: never store question, field values, raw IP, citizen id or application id.
CREATE TABLE IF NOT EXISTS citizen_friction_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),
 procedure_id text REFERENCES procedures(id),stage text NOT NULL CHECK(stage IN ('lookup','form','documents','review','chat')),
 issue text NOT NULL CHECK(issue IN ('needs_help','unclear_field','validation_problem','abandoned','insufficient_answer')),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citizen_friction_events_grouping ON citizen_friction_events(tenant_id,occurred_at,stage,issue);
CREATE OR REPLACE FUNCTION citizen_staff_friction_summary(p_tenant uuid)
RETURNS TABLE(stage text,issue text,events bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT f.stage,f.issue,count(*) FROM citizen_friction_events f
 WHERE f.tenant_id=p_tenant AND f.occurred_at>=now()-interval '90 days'
 GROUP BY f.stage,f.issue HAVING count(*)>=5 ORDER BY count(*) DESC LIMIT 40;
$$;
REVOKE ALL ON FUNCTION citizen_staff_friction_summary(uuid) FROM PUBLIC;

-- Opt-in reminder dispatcher: privilege confined to atomic, idempotent inserts.
-- Called only from a guarded internal endpoint or scheduled host job.
CREATE OR REPLACE FUNCTION citizen_dispatch_reminders(p_limit integer DEFAULT 300)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; n integer:=0; v_key text;
BEGIN
 IF p_limit<1 OR p_limit>1000 THEN RAISE EXCEPTION 'Invalid limit' USING ERRCODE='22023';END IF;
 FOR r IN
   SELECT t.id,t.citizen_id,t.tenant_id,t.due_on,s.days_before,t.title,
          t.application_id
   FROM citizen_personal_tasks t JOIN citizen_reminder_settings s ON s.citizen_id=t.citizen_id AND s.tenant_id=t.tenant_id
   WHERE s.enabled=true AND t.completed_at IS NULL AND t.due_on BETWEEN CURRENT_DATE AND CURRENT_DATE+s.days_before
   ORDER BY t.due_on,t.id LIMIT p_limit
 LOOP
   v_key:='task:'||r.id::text||':'||r.due_on::text;
   INSERT INTO citizen_reminder_deliveries(citizen_id,tenant_id,reminder_key)
   VALUES(r.citizen_id,r.tenant_id,v_key) ON CONFLICT DO NOTHING;
   IF FOUND THEN
     INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body,category)
     VALUES(r.citizen_id,r.tenant_id,r.application_id,'Nhắc việc hành chính',
       'Có công việc cần hoàn thành vào ngày '||to_char(r.due_on,'DD/MM/YYYY')||'. Vui lòng mở lịch hành chính để kiểm tra.','reminder');
     n:=n+1;
   END IF;
 END LOOP;
 -- Official case due dates: notify in-app; not a prediction of actual completion.
 FOR r IN SELECT a.id,a.citizen_id,a.tenant_id,a.due_at
  FROM applications a JOIN citizen_reminder_settings s ON s.citizen_id=a.citizen_id AND s.tenant_id=a.tenant_id
  WHERE s.enabled AND a.status IN ('submitted','processing','supplement')
    AND a.due_at BETWEEN CURRENT_DATE AND CURRENT_DATE+s.days_before
  ORDER BY a.due_at,a.id LIMIT p_limit
 LOOP
   v_key:='case:'||r.id||':'||r.due_at::text;
   INSERT INTO citizen_reminder_deliveries(citizen_id,tenant_id,reminder_key)
     VALUES(r.citizen_id,r.tenant_id,v_key) ON CONFLICT DO NOTHING;
   IF FOUND THEN
     INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body,category)
       VALUES(r.citizen_id,r.tenant_id,r.id,'Nhắc thời hạn hồ sơ',
        'Hồ sơ có hạn xử lý ngày '||to_char(r.due_at,'DD/MM/YYYY')||'. Hãy kiểm tra tiến độ trong hệ thống.','reminder');
     n:=n+1;
   END IF;
 END LOOP;
 -- Confirmed one-stop appointments; no unverified statutory deadlines are inferred.
 FOR r IN SELECT b.id,b.citizen_id,b.tenant_id,s.starts_at
   FROM citizen_counter_bookings b JOIN citizen_counter_slots s ON s.id=b.slot_id
   JOIN citizen_reminder_settings pref ON pref.citizen_id=b.citizen_id AND pref.tenant_id=b.tenant_id
   WHERE pref.enabled AND b.status='booked' AND s.starts_at>=now()
     AND s.starts_at<=now()+(pref.days_before||' days')::interval
   ORDER BY s.starts_at,b.id LIMIT p_limit
 LOOP
   v_key:='booking:'||r.id||':'||r.starts_at::text;
   INSERT INTO citizen_reminder_deliveries(citizen_id,tenant_id,reminder_key)
     VALUES(r.citizen_id,r.tenant_id,v_key) ON CONFLICT DO NOTHING;
   IF FOUND THEN
     INSERT INTO citizen_notifications(citizen_id,tenant_id,title,body,category)
       VALUES(r.citizen_id,r.tenant_id,'Nhắc lịch hẹn tại quầy',
        'Bạn có lịch hẹn vào '||to_char(r.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh','DD/MM/YYYY HH24:MI')||'. Vui lòng kiểm tra chi tiết lịch hẹn.','reminder');
     n:=n+1;
   END IF;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION citizen_dispatch_reminders(integer) FROM PUBLIC;

DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
 GRANT SELECT,INSERT,UPDATE(status,title,updated_at) ON citizen_life_journeys TO communeos_app;
 GRANT SELECT,INSERT,UPDATE(state,application_id,updated_at) ON citizen_life_journey_items TO communeos_app;
 GRANT SELECT,INSERT,UPDATE(enabled,days_before,updated_at) ON citizen_reminder_settings TO communeos_app;
 GRANT SELECT,INSERT,UPDATE(completed_at) ON citizen_personal_tasks TO communeos_app;
 GRANT SELECT ON citizen_reminder_deliveries TO communeos_app;
 GRANT SELECT,INSERT,UPDATE(step,revision,updated_at) ON citizen_draft_cursors TO communeos_app;
 GRANT INSERT ON citizen_friction_events TO communeos_app;
 GRANT EXECUTE ON FUNCTION citizen_dispatch_reminders(integer),citizen_staff_friction_summary(uuid) TO communeos_app;
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO communeos_app;
END IF; END $$;
