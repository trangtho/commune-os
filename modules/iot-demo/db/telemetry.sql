-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Demo synthetic temperature readings only; not a production device identity or safety system.
CREATE SCHEMA IF NOT EXISTS telemetry_demo;
REVOKE ALL ON SCHEMA telemetry_demo FROM PUBLIC;
CREATE TABLE IF NOT EXISTS telemetry_demo.readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  event_id uuid NOT NULL,
  device text NOT NULL CHECK (device ~ '^[a-z0-9-]{1,64}$'),
  observed_at timestamptz NOT NULL,
  value_c numeric(5,2) NOT NULL CHECK (value_c BETWEEN -50 AND 100),
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,event_id)
);
CREATE INDEX IF NOT EXISTS telemetry_time ON telemetry_demo.readings(tenant_id,observed_at,id);
CREATE TABLE IF NOT EXISTS telemetry_demo.alerts (
  id uuid PRIMARY KEY REFERENCES telemetry_demo.readings(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','resolved','false_alarm')),
  decided_at timestamptz,
  note text CHECK (length(note)<=500)
);
ALTER TABLE telemetry_demo.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_demo.alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_read ON telemetry_demo.readings;
CREATE POLICY tenant_read ON telemetry_demo.readings FOR SELECT USING(tenant_id=(SELECT t.id FROM public.tenants t WHERE t.code=public.current_tenant_code() AND t.status='active' AND public.tenant_has_module(t.id,'iot-demo')));
DROP POLICY IF EXISTS tenant_read ON telemetry_demo.alerts;
CREATE POLICY tenant_read ON telemetry_demo.alerts FOR SELECT USING(tenant_id=(SELECT t.id FROM public.tenants t WHERE t.code=public.current_tenant_code() AND t.status='active' AND public.tenant_has_module(t.id,'iot-demo')));
CREATE OR REPLACE VIEW api.telemetry_readings WITH (security_invoker=true) AS
SELECT r.id,t.code tenant_code,r.event_id,r.device,r.observed_at,r.value_c,r.received_at FROM telemetry_demo.readings r JOIN public.tenants t ON t.id=r.tenant_id;
CREATE OR REPLACE VIEW api.telemetry_daily WITH (security_invoker=true) AS
SELECT t.code tenant_code,r.device,(r.observed_at AT TIME ZONE 'UTC')::date day_utc,count(*) reading_count,round(avg(r.value_c),2) avg_c,max(r.value_c) max_c
FROM telemetry_demo.readings r JOIN public.tenants t ON t.id=r.tenant_id GROUP BY t.code,r.device,(r.observed_at AT TIME ZONE 'UTC')::date;
CREATE OR REPLACE VIEW api.telemetry_alerts WITH (security_invoker=true) AS
SELECT a.id,t.code tenant_code,a.status,r.device,r.value_c,r.observed_at,a.decided_at,a.note FROM telemetry_demo.alerts a JOIN telemetry_demo.readings r ON r.id=a.id AND r.tenant_id=a.tenant_id JOIN public.tenants t ON t.id=a.tenant_id;
CREATE OR REPLACE FUNCTION api.telemetry_ingest(p_event_id uuid,p_device text,p_observed_at timestamptz,p_value numeric) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_code text:=public.require_module('iot-demo'); v_tenant uuid:=(SELECT id FROM tenants WHERE code=v_code); v telemetry_demo.readings; v_new boolean;
BEGIN
  IF p_event_id IS NULL OR p_device IS NULL OR p_device !~ '^[a-z0-9-]{1,64}$' OR p_observed_at IS NULL OR p_observed_at>now()+interval '5 minutes' OR p_observed_at<now()-interval '90 days' OR p_value IS NULL OR p_value NOT BETWEEN -50 AND 100 OR p_value<>round(p_value,2) THEN RAISE EXCEPTION 'Invalid demo reading' USING ERRCODE='22023'; END IF;
  INSERT INTO telemetry_demo.readings(tenant_id,event_id,device,observed_at,value_c) VALUES(v_tenant,p_event_id,p_device,p_observed_at,p_value) ON CONFLICT(tenant_id,event_id) DO NOTHING RETURNING * INTO v;
  v_new:=FOUND;
  IF NOT v_new THEN
    SELECT * INTO v FROM telemetry_demo.readings WHERE tenant_id=v_tenant AND event_id=p_event_id;
    IF v.device IS DISTINCT FROM p_device OR v.observed_at IS DISTINCT FROM p_observed_at OR v.value_c IS DISTINCT FROM p_value THEN RAISE EXCEPTION 'Event ID reused with different data' USING ERRCODE='PT409'; END IF;
  END IF;
  IF v_new AND v.value_c>=35 THEN
    INSERT INTO telemetry_demo.alerts(id,tenant_id) VALUES(v.id,v_tenant);
    PERFORM public.ledger_record(v_tenant,v.id::text,'submitted',public.current_staff_name(),'Simulated temperature alert',now());
  END IF;
  RETURN json_build_object('id',v.id,'duplicate',NOT v_new,'alert',v.value_c>=35);
END $$;
CREATE OR REPLACE FUNCTION api.telemetry_alert_status(p_id text,status text,note text DEFAULT NULL) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_code text; v telemetry_demo.alerts; v_note text:=nullif(btrim(coalesce(note,'')),'');
BEGIN
  IF NOT public.is_workflow_call() THEN RAISE EXCEPTION 'Use workflow API' USING ERRCODE='42501'; END IF;
  v_code:=public.require_module('iot-demo'); PERFORM public.require_leader();
  SELECT a.* INTO v FROM telemetry_demo.alerts a JOIN tenants t ON t.id=a.tenant_id WHERE a.id::text=p_id AND t.code=v_code FOR UPDATE OF a;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Alert not found' USING ERRCODE='P0002'; END IF;
  IF v.status<>'submitted' THEN RAISE EXCEPTION 'Already decided' USING ERRCODE='PT409'; END IF;
  IF status IS NULL OR status NOT IN ('resolved','false_alarm') OR length(coalesce(v_note,''))>500 OR (status='false_alarm' AND v_note IS NULL) THEN RAISE EXCEPTION 'Invalid decision' USING ERRCODE='22023'; END IF;
  UPDATE telemetry_demo.alerts a SET status=telemetry_alert_status.status,note=v_note,decided_at=now() WHERE a.id=v.id RETURNING * INTO v;
  PERFORM public.ledger_record(v.tenant_id,v.id::text,v.status,public.current_staff_name(),v_note,v.decided_at);
  RETURN json_build_object('id',v.id,'status',v.status);
END $$;
REVOKE ALL ON FUNCTION api.telemetry_ingest(uuid,text,timestamptz,numeric),api.telemetry_alert_status(text,text,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA telemetry_demo TO "commune-app";
GRANT SELECT ON telemetry_demo.readings,telemetry_demo.alerts,api.telemetry_readings,api.telemetry_daily,api.telemetry_alerts TO "commune-app";
GRANT EXECUTE ON FUNCTION api.telemetry_ingest(uuid,text,timestamptz,numeric),api.telemetry_alert_status(text,text,text) TO "commune-app";
NOTIFY pgrst,'reload schema';
