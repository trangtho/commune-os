-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Citizen case requests, deadline alerts, legal result channels and verified staff routing.
-- Do not seed legal delivery or inter-agency permissions: staff must explicitly publish them.

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('draft','submitted','processing','supplement','completed','rejected','withdrawn'));

CREATE TABLE IF NOT EXISTS citizen_case_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 request_kind text NOT NULL CHECK(request_kind IN ('deadline_review','amendment','withdrawal','transfer')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 2000),
 proposed_tenant_id uuid REFERENCES tenants(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 staff_response text NOT NULL DEFAULT '',
 decided_by text,
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 CHECK ((request_kind='transfer')=(proposed_tenant_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS citizen_case_pending_requests_unique
 ON citizen_case_requests(application_id,request_kind) WHERE status='pending';
CREATE INDEX IF NOT EXISTS citizen_case_requests_staff_idx ON citizen_case_requests(tenant_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS citizen_deadline_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 alert_level text NOT NULL CHECK(alert_level IN ('approaching','overdue')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(application_id,alert_level)
);

CREATE TABLE IF NOT EXISTS citizen_result_channels (
 procedure_id text NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 method text NOT NULL CHECK(method IN ('online','counter','postal')),
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference))>=5),
 instructions text NOT NULL DEFAULT '' CHECK(length(instructions)<=1000),
 enabled boolean NOT NULL DEFAULT false,
 valid_until timestamptz NOT NULL,
 PRIMARY KEY(procedure_id,tenant_id,method)
);
CREATE TABLE IF NOT EXISTS citizen_case_deliveries (
 application_id text PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 method text NOT NULL CHECK(method IN ('online','counter','postal')),
 delivery_address text NOT NULL DEFAULT '' CHECK(length(delivery_address)<=500),
 contact_phone text NOT NULL DEFAULT '' CHECK(length(contact_phone)<=20),
 status text NOT NULL DEFAULT 'selected' CHECK(status IN ('selected','ready','in_transit','delivered','failed')),
 shipment_reference text NOT NULL DEFAULT '',
 staff_note text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(method<>'postal' OR (length(btrim(delivery_address))>=10 AND length(btrim(contact_phone))>=9))
);
CREATE TABLE IF NOT EXISTS citizen_case_transfer_handoffs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 request_id uuid NOT NULL UNIQUE REFERENCES citizen_case_requests(id),
 source_tenant_id uuid NOT NULL REFERENCES tenants(id),
 destination_tenant_id uuid NOT NULL REFERENCES tenants(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','received','declined')),
 initiated_by text NOT NULL,
 decided_by text,
 decision_note text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 CHECK(source_tenant_id<>destination_tenant_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS citizen_case_one_active_transfer
 ON citizen_case_transfer_handoffs(application_id) WHERE status='pending';

ALTER TABLE citizen_case_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_case_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_case_requests_owner_read ON citizen_case_requests;
CREATE POLICY citizen_case_requests_owner_read ON citizen_case_requests FOR SELECT
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
  AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id));
DROP POLICY IF EXISTS citizen_case_requests_owner_insert ON citizen_case_requests;
CREATE POLICY citizen_case_requests_owner_insert ON citizen_case_requests FOR INSERT
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
  AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id AND a.citizen_id=citizen_id AND a.tenant_id=tenant_id));

ALTER TABLE citizen_deadline_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_deadline_alerts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_deadline_alerts_owner ON citizen_deadline_alerts;
CREATE POLICY citizen_deadline_alerts_owner ON citizen_deadline_alerts FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
  AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
  AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id AND a.citizen_id=citizen_id AND a.tenant_id=tenant_id));

ALTER TABLE citizen_result_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_result_channels FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_result_channels_publication ON citizen_result_channels;
CREATE POLICY citizen_result_channels_publication ON citizen_result_channels FOR SELECT
 USING(enabled AND valid_until>now());

ALTER TABLE citizen_case_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_case_deliveries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_case_deliveries_owner ON citizen_case_deliveries;
CREATE POLICY citizen_case_deliveries_owner ON citizen_case_deliveries FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
  AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
  AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
  AND EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id));

ALTER TABLE citizen_case_transfer_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_case_transfer_handoffs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_case_transfer_owner_read ON citizen_case_transfer_handoffs;
CREATE POLICY citizen_case_transfer_owner_read ON citizen_case_transfer_handoffs FOR SELECT
 USING(EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id));

-- Security-definer functions are the sole staff mutation surface. The bridge validates
-- the authenticated staff service token separately; tenant ID is still rechecked here.
CREATE OR REPLACE FUNCTION public.citizen_staff_decide_case_request(
 p_id uuid,p_tenant uuid,p_staff text,p_approve boolean,p_response text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; a record;
BEGIN
 IF length(btrim(p_staff))<2 OR length(btrim(p_response))<5 THEN RAISE EXCEPTION 'Thiếu thông tin người xử lý hoặc lý do quyết định'; END IF;
 SELECT * INTO r FROM citizen_case_requests WHERE id=p_id AND status='pending' FOR UPDATE;
 IF NOT FOUND OR r.request_kind='transfer' THEN RETURN false; END IF;
 SELECT * INTO a FROM applications WHERE id=r.application_id FOR UPDATE;
 IF COALESCE(a.receiving_tenant_id,a.tenant_id)<>p_tenant THEN RETURN false; END IF;
 IF r.request_kind='withdrawal' AND p_approve AND a.status NOT IN ('submitted','processing','supplement') THEN
  RAISE EXCEPTION 'Hồ sơ không còn đủ điều kiện để rút';
 END IF;
 UPDATE citizen_case_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
   staff_response=p_response,decided_by=p_staff,decided_at=now() WHERE id=p_id;
 IF r.request_kind='withdrawal' AND p_approve THEN
  UPDATE applications SET status='withdrawn',updated_at=now() WHERE id=a.id;
 END IF;
 INSERT INTO application_events(application_id,event_type,note,actor_name)
 VALUES(a.id,'citizen_request_decided',left('Yêu cầu '||r.request_kind||': '||p_response,1000),p_staff);
 INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body)
 VALUES(a.citizen_id,a.tenant_id,a.id,'Yêu cầu về hồ sơ đã được phản hồi',
 left('Yêu cầu '||r.request_kind||' đã '||CASE WHEN p_approve THEN 'được chấp thuận' ELSE 'bị từ chối' END||'. '||p_response,450));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.citizen_staff_decide_case_request(uuid,uuid,text,boolean,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.citizen_staff_start_case_transfer(
 p_request uuid,p_tenant uuid,p_staff text,p_response text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r record; a record; x uuid;
BEGIN
 IF length(btrim(p_staff))<2 OR length(btrim(p_response))<5 THEN RAISE EXCEPTION 'Thiếu xác nhận và lý do của cán bộ'; END IF;
 SELECT * INTO r FROM citizen_case_requests WHERE id=p_request AND status='pending' AND request_kind='transfer' FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO a FROM applications WHERE id=r.application_id FOR UPDATE;
 IF a.status NOT IN ('submitted','processing','supplement') OR COALESCE(a.receiving_tenant_id,a.tenant_id)<>p_tenant THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM citizen_procedure_receivers cr WHERE cr.procedure_id=a.procedure_id
   AND cr.source_tenant_id=p_tenant AND cr.receiving_tenant_id=r.proposed_tenant_id
   AND cr.enabled AND cr.valid_until>now() AND btrim(cr.approval_reference)<>'') THEN
  RAISE EXCEPTION 'Chưa có tuyến chuyển cơ quan được phê duyệt';
 END IF;
 INSERT INTO citizen_case_transfer_handoffs(application_id,request_id,source_tenant_id,destination_tenant_id,initiated_by)
 VALUES(a.id,p_request,p_tenant,r.proposed_tenant_id,p_staff) RETURNING id INTO x;
 UPDATE citizen_case_requests SET status='approved',staff_response=p_response,decided_by=p_staff,decided_at=now() WHERE id=p_request;
 INSERT INTO application_events(application_id,event_type,note,actor_name)
 VALUES(a.id,'transfer_sent',left('Đã đề nghị chuyển cơ quan: '||p_response,1000),p_staff);
 INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body)
 VALUES(a.citizen_id,a.tenant_id,a.id,'Hồ sơ đang chờ đơn vị mới tiếp nhận',
 'Đề nghị chuyển cơ quan được cán bộ xử lý; chưa hoàn thành chuyển giao.');
 RETURN x;
END $$;
REVOKE ALL ON FUNCTION public.citizen_staff_start_case_transfer(uuid,uuid,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.citizen_staff_accept_case_transfer(
 p_id uuid,p_tenant uuid,p_staff text,p_accept boolean,p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE t record; a record;
BEGIN
 IF length(btrim(p_staff))<2 OR length(btrim(p_note))<5 THEN RAISE EXCEPTION 'Thiếu lý do xác nhận chuyển giao'; END IF;
 SELECT * INTO t FROM citizen_case_transfer_handoffs WHERE id=p_id AND status='pending' FOR UPDATE;
 IF NOT FOUND OR t.destination_tenant_id<>p_tenant THEN RETURN false; END IF;
 SELECT * INTO a FROM applications WHERE id=t.application_id FOR UPDATE;
 IF a.status NOT IN ('submitted','processing','supplement') OR COALESCE(a.receiving_tenant_id,a.tenant_id)<>t.source_tenant_id THEN RETURN false; END IF;
 IF p_accept AND NOT EXISTS(SELECT 1 FROM citizen_procedure_receivers cr WHERE cr.procedure_id=a.procedure_id
   AND cr.source_tenant_id=t.source_tenant_id AND cr.receiving_tenant_id=t.destination_tenant_id
   AND cr.enabled AND cr.valid_until>now() AND btrim(cr.approval_reference)<>'') THEN
  RAISE EXCEPTION 'Tuyến chuyển giao đã hết hiệu lực'; END IF;
 UPDATE citizen_case_transfer_handoffs SET status=CASE WHEN p_accept THEN 'received' ELSE 'declined' END,
 decided_by=p_staff,decision_note=p_note,decided_at=now() WHERE id=p_id;
 IF p_accept THEN
  -- A result channel selected for the source office is not automatically valid at the destination.
  DELETE FROM citizen_case_deliveries WHERE application_id=a.id AND status='selected';
  UPDATE applications SET receiving_tenant_id=t.destination_tenant_id,updated_at=now() WHERE id=a.id;
 ELSE UPDATE citizen_case_requests SET status='rejected',staff_response=p_note WHERE id=t.request_id; END IF;
 INSERT INTO application_events(application_id,event_type,note,actor_name)
 VALUES(a.id,CASE WHEN p_accept THEN 'transfer_received' ELSE 'transfer_declined' END,left(p_note,1000),p_staff);
 INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body)
 VALUES(a.citizen_id,a.tenant_id,a.id,CASE WHEN p_accept THEN 'Đơn vị mới đã tiếp nhận hồ sơ' ELSE 'Đề nghị chuyển cơ quan không được tiếp nhận' END,left(p_note,450));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.citizen_staff_accept_case_transfer(uuid,uuid,text,boolean,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.citizen_staff_publish_result_channel(
 p_procedure text,p_tenant uuid,p_method text,p_reference text,p_valid_until timestamptz,p_instructions text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_method NOT IN ('online','counter','postal') OR length(btrim(p_reference))<5 OR p_valid_until<=now()
   OR length(coalesce(p_instructions,''))>1000 THEN RAISE EXCEPTION 'Thiếu căn cứ phê duyệt phương thức nhận kết quả'; END IF;
 INSERT INTO citizen_result_channels(procedure_id,tenant_id,method,approval_reference,instructions,enabled,valid_until)
 VALUES(p_procedure,p_tenant,p_method,p_reference,coalesce(p_instructions,''),true,p_valid_until)
 ON CONFLICT(procedure_id,tenant_id,method) DO UPDATE SET approval_reference=EXCLUDED.approval_reference,
 instructions=EXCLUDED.instructions,enabled=true,valid_until=EXCLUDED.valid_until;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.citizen_staff_publish_result_channel(text,uuid,text,text,timestamptz,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.citizen_staff_update_delivery(
 p_application text,p_tenant uuid,p_staff text,p_status text,p_reference text,p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d record; a record;
BEGIN
 IF length(btrim(p_staff))<2 OR p_status NOT IN ('ready','in_transit','delivered','failed') THEN RAISE EXCEPTION 'Cập nhật giao nhận không hợp lệ'; END IF;
 SELECT * INTO d FROM citizen_case_deliveries WHERE application_id=p_application FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO a FROM applications WHERE id=p_application;
 IF COALESCE(a.receiving_tenant_id,a.tenant_id)<>p_tenant OR a.status <> 'completed' THEN RETURN false; END IF;
 IF NOT (
  (d.status='selected' AND p_status IN ('ready','failed')) OR
  (d.status='ready' AND ((d.method='postal' AND p_status IN ('in_transit','failed'))
     OR (d.method<>'postal' AND p_status IN ('delivered','failed')))) OR
  (d.status='in_transit' AND p_status IN ('delivered','failed')) OR
  (d.status='failed' AND p_status IN ('ready','in_transit'))
 ) THEN RAISE EXCEPTION 'Chuyển trạng thái giao nhận không hợp lệ'; END IF;
 IF p_status='in_transit' AND (d.method<>'postal' OR length(btrim(p_reference))<3)
 THEN RAISE EXCEPTION 'Thiếu mã vận đơn hoặc không phải nhận bưu chính'; END IF;
 UPDATE citizen_case_deliveries SET status=p_status,shipment_reference=left(p_reference,120),staff_note=left(p_note,1000),updated_at=now()
 WHERE application_id=p_application;
 INSERT INTO application_events(application_id,event_type,note,actor_name)
 VALUES(p_application,'delivery_status',left('Trạng thái nhận kết quả: '||p_status||'. '||p_note,1000),p_staff);
 INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body)
 VALUES(a.citizen_id,a.tenant_id,a.id,'Thông tin nhận kết quả được cập nhật',left('Trạng thái: '||p_status||'. '||p_note,450));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.citizen_staff_update_delivery(text,uuid,text,text,text,text) FROM PUBLIC;

-- Caller must be trusted server-side scheduler. Checks only one tenant per request.
CREATE OR REPLACE FUNCTION public.citizen_staff_scan_deadlines(p_tenant uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer;
BEGIN
 WITH candidates AS (
  SELECT a.id,a.citizen_id,a.tenant_id,
   CASE WHEN a.due_at<CURRENT_DATE THEN 'overdue' ELSE 'approaching' END AS level
  FROM applications a WHERE COALESCE(a.receiving_tenant_id,a.tenant_id)=p_tenant
   AND a.status IN ('submitted','processing','supplement') AND a.due_at IS NOT NULL
   AND a.due_at<=CURRENT_DATE+2
 ), inserted AS (
  INSERT INTO citizen_deadline_alerts(application_id,citizen_id,tenant_id,alert_level)
  SELECT id,citizen_id,tenant_id,level FROM candidates
  ON CONFLICT(application_id,alert_level) DO NOTHING
  RETURNING application_id,citizen_id,tenant_id,alert_level
 ), notices AS (
  INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body,category)
  SELECT citizen_id,tenant_id,application_id,
   CASE WHEN alert_level='overdue' THEN 'Hồ sơ đã quá hạn giải quyết' ELSE 'Hồ sơ gần đến hạn giải quyết' END,
   CASE WHEN alert_level='overdue' THEN 'Hãy kiểm tra thời hạn và yêu cầu xem xét nếu cần.' ELSE 'Hồ sơ sắp đến hạn; theo dõi cập nhật của cơ quan xử lý.' END,'case'
  FROM inserted RETURNING id
 ) SELECT count(*) INTO n FROM notices;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.citizen_staff_scan_deadlines(uuid) FROM PUBLIC;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
  GRANT SELECT ON citizen_case_requests,citizen_deadline_alerts,citizen_result_channels,
    citizen_case_deliveries,citizen_case_transfer_handoffs TO communeos_app;
  GRANT INSERT(application_id,citizen_id,tenant_id,request_kind,reason,proposed_tenant_id)
    ON citizen_case_requests TO communeos_app;
  GRANT INSERT(application_id,citizen_id,tenant_id,alert_level) ON citizen_deadline_alerts TO communeos_app;
  GRANT INSERT(application_id,citizen_id,tenant_id,method,delivery_address,contact_phone)
    ON citizen_case_deliveries TO communeos_app;
  GRANT UPDATE(method,delivery_address,contact_phone,updated_at) ON citizen_case_deliveries TO communeos_app;
  GRANT EXECUTE ON FUNCTION public.citizen_staff_decide_case_request(uuid,uuid,text,boolean,text),
    public.citizen_staff_start_case_transfer(uuid,uuid,text,text),
    public.citizen_staff_accept_case_transfer(uuid,uuid,text,boolean,text),
    public.citizen_staff_publish_result_channel(text,uuid,text,text,timestamptz,text),
    public.citizen_staff_update_delivery(text,uuid,text,text,text,text),
    public.citizen_staff_scan_deadlines(uuid) TO communeos_app;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.citizen_staff_list_case_requests(p_tenant uuid)
RETURNS TABLE(id uuid,application_id text,procedure_id text,request_kind text,reason text,
 proposed_tenant_id uuid,status text,created_at timestamptz,due_at date)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
 SELECT r.id,r.application_id,a.procedure_id,r.request_kind,r.reason,
  r.proposed_tenant_id,r.status,r.created_at,a.due_at
 FROM citizen_case_requests r JOIN applications a ON a.id=r.application_id
 WHERE COALESCE(a.receiving_tenant_id,a.tenant_id)=p_tenant AND r.status='pending'
 ORDER BY r.created_at ASC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.citizen_staff_list_case_requests(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.citizen_staff_list_transfers(p_tenant uuid)
RETURNS TABLE(id uuid,application_id text,source_tenant_id uuid,destination_tenant_id uuid,
 created_at timestamptz)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
 SELECT t.id,t.application_id,t.source_tenant_id,t.destination_tenant_id,t.created_at
 FROM citizen_case_transfer_handoffs t WHERE t.destination_tenant_id=p_tenant AND t.status='pending'
 ORDER BY t.created_at ASC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION public.citizen_staff_list_transfers(uuid) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
  GRANT EXECUTE ON FUNCTION public.citizen_staff_list_case_requests(uuid),
   public.citizen_staff_list_transfers(uuid) TO communeos_app;
 END IF;
END $$;
