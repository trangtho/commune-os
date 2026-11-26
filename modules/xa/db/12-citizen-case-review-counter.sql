-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Citizen preflight is computed from stored application data; no synthetic legal approval.
-- Queue slots and detailed case stages are published by authorized staff only.

CREATE TABLE IF NOT EXISTS citizen_counter_slots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 procedure_id text NOT NULL REFERENCES procedures(id),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 200),
 next_ticket_no integer NOT NULL DEFAULT 1,
 serving_ticket_no integer,
 published boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at),
 UNIQUE(tenant_id,procedure_id,starts_at)
);
CREATE INDEX IF NOT EXISTS citizen_counter_slots_schedule ON citizen_counter_slots(starts_at,tenant_id,procedure_id);
CREATE TABLE IF NOT EXISTS citizen_counter_bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slot_id uuid NOT NULL REFERENCES citizen_counter_slots(id),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 procedure_id text NOT NULL REFERENCES procedures(id),
 ticket_number integer NOT NULL CHECK(ticket_number>0),
 status text NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','checked_in','serving','done','no_show','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(slot_id,ticket_number)
);
CREATE INDEX IF NOT EXISTS citizen_counter_bookings_owner ON citizen_counter_bookings(citizen_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS citizen_counter_bookings_unique_active ON citizen_counter_bookings(slot_id,citizen_id)
 WHERE status IN ('booked','checked_in','serving');

CREATE TABLE IF NOT EXISTS citizen_case_stage_updates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 stage_name text NOT NULL CHECK(length(btrim(stage_name)) BETWEEN 2 AND 120),
 unit_name text NOT NULL DEFAULT '' CHECK(length(unit_name)<=120),
 stage_status text NOT NULL CHECK(stage_status IN ('pending','active','done','paused')),
 due_at timestamptz,
 reason text NOT NULL DEFAULT '' CHECK(length(reason)<=500),
 staff_name text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citizen_case_stages_case ON citizen_case_stage_updates(application_id,created_at,id);

CREATE TABLE IF NOT EXISTS citizen_supplement_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 request_event_id bigint NOT NULL REFERENCES application_events(id),
 kind text NOT NULL CHECK(kind IN ('document','field')),
 target_key text NOT NULL CHECK(length(target_key) BETWEEN 1 AND 100),
 instruction text NOT NULL CHECK(length(btrim(instruction)) BETWEEN 5 AND 500),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 500),
 citizen_response text CHECK(length(citizen_response)<=1000),
 document_id uuid REFERENCES application_documents(id) ON DELETE SET NULL,
 responded_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind='document' AND citizen_response IS NULL) OR (kind='field' AND document_id IS NULL))
);
CREATE INDEX IF NOT EXISTS citizen_supplement_items_case ON citizen_supplement_items(application_id,request_event_id);

-- Citizen reads only its own records; staff update operations are separate vetted RPCs.
ALTER TABLE citizen_counter_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_counter_slots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_counter_slots_public ON citizen_counter_slots;
CREATE POLICY citizen_counter_slots_public ON citizen_counter_slots FOR SELECT
 USING(published AND starts_at>now() AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE citizen_counter_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_counter_bookings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_counter_booking_owner ON citizen_counter_bookings;
CREATE POLICY citizen_counter_booking_owner ON citizen_counter_bookings FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
   AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
   AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE citizen_case_stage_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_case_stage_updates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_case_stages_owner ON citizen_case_stage_updates;
CREATE POLICY citizen_case_stages_owner ON citizen_case_stage_updates FOR SELECT
 USING(EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id));
ALTER TABLE citizen_supplement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_supplement_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_supplement_owner ON citizen_supplement_items;
CREATE POLICY citizen_supplement_owner ON citizen_supplement_items FOR SELECT
 USING(EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id));

-- Citizen cancellations do not grant unrestricted UPDATE on bookings.
CREATE OR REPLACE FUNCTION citizen_cancel_counter_booking(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_citizen uuid:=nullif(current_setting('app.citizen_id',true),'')::uuid;
DECLARE v_tenant uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid;
BEGIN
 IF v_citizen IS NULL OR v_tenant IS NULL THEN RETURN false; END IF;
 UPDATE citizen_counter_bookings b SET status='cancelled',updated_at=now()
 FROM citizen_counter_slots s
 WHERE b.id=p_id AND s.id=b.slot_id AND s.starts_at>now()
 AND b.citizen_id=v_citizen AND b.tenant_id=v_tenant AND b.status='booked';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION citizen_cancel_counter_booking(uuid) FROM PUBLIC;

-- Slot availability must count all bookings, not just the caller-visible RLS rows.
CREATE OR REPLACE FUNCTION citizen_counter_slot_remaining(p_slot_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_tenant uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid;
DECLARE remaining integer;
BEGIN
 SELECT greatest(0,s.capacity-(SELECT count(*)::integer FROM citizen_counter_bookings b
  WHERE b.slot_id=s.id AND b.status IN ('booked','checked_in','serving','done')))
 INTO remaining FROM citizen_counter_slots s WHERE s.id=p_slot_id
 AND s.tenant_id=v_tenant AND s.published AND s.starts_at>now();
 RETURN coalesce(remaining,0);
END $$;
REVOKE ALL ON FUNCTION citizen_counter_slot_remaining(uuid) FROM PUBLIC;

-- Atomic server-authoritative ticket allocation; the web role cannot edit slot counters.
CREATE OR REPLACE FUNCTION citizen_book_counter_slot(p_slot_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_citizen uuid:=nullif(current_setting('app.citizen_id',true),'')::uuid;
DECLARE v_tenant uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid;
DECLARE s record; v_count integer; v_id uuid; v_ticket integer;
BEGIN
 IF v_citizen IS NULL OR v_tenant IS NULL THEN RAISE EXCEPTION 'Cần đăng nhập' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM citizen_counter_slots WHERE id=p_slot_id FOR UPDATE;
 IF s.id IS NULL OR s.tenant_id<>v_tenant OR NOT s.published
  OR s.starts_at<=now()+interval '1 hour' OR s.starts_at>now()+interval '31 days'
  OR NOT EXISTS(SELECT 1 FROM procedures WHERE id=s.procedure_id AND published) THEN
  RAISE EXCEPTION 'Khung giờ không còn khả dụng' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM citizen_counter_bookings WHERE slot_id=s.id AND citizen_id=v_citizen
  AND status IN ('booked','checked_in','serving')) THEN
  RAISE EXCEPTION 'Bạn đã có số thứ tự ở khung giờ này' USING ERRCODE='22023'; END IF;
 SELECT count(*)::integer INTO v_count FROM citizen_counter_bookings
 WHERE slot_id=s.id AND status IN ('booked','checked_in','serving','done');
 IF v_count>=s.capacity THEN RAISE EXCEPTION 'Khung giờ đã đủ số lượng' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM citizen_counter_bookings WHERE citizen_id=v_citizen AND status='booked'
  AND slot_id IN(SELECT id FROM citizen_counter_slots WHERE starts_at>now()))>=3 THEN
  RAISE EXCEPTION 'Bạn đã có tối đa 3 lịch hẹn tại quầy' USING ERRCODE='22023'; END IF;
 v_ticket:=s.next_ticket_no;
 UPDATE citizen_counter_slots SET next_ticket_no=next_ticket_no+1 WHERE id=s.id;
 INSERT INTO citizen_counter_bookings(slot_id,citizen_id,tenant_id,procedure_id,ticket_number)
 VALUES(s.id,v_citizen,v_tenant,s.procedure_id,v_ticket) RETURNING id INTO v_id;
 INSERT INTO citizen_notifications(citizen_id,tenant_id,category,title,body)
 VALUES(v_citizen,v_tenant,'appointment','Đã cấp số thứ tự tại quầy',
   'Số '||v_ticket||' cho lịch hẹn tại quầy. Vui lòng kiểm tra mục Lịch tại quầy.');
 RETURN jsonb_build_object('id',v_id,'ticket_number',v_ticket,'status','booked');
END $$;
REVOKE ALL ON FUNCTION citizen_book_counter_slot(uuid) FROM PUBLIC;

-- Staff-authenticated PostgREST RPC; citizen app role cannot invoke these.
CREATE OR REPLACE FUNCTION api.publish_counter_slot(p_procedure_id text,p_starts_at timestamptz,p_ends_at timestamptz,p_capacity integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
DECLARE t uuid; v_id uuid;
BEGIN
 IF NOT(coalesce(c->'realm_access'->'roles','[]'::jsonb) ?| ARRAY['receptionist','officer','leader']) THEN
  RAISE EXCEPTION 'Yêu cầu quyền cán bộ' USING ERRCODE='42501'; END IF;
 SELECT id INTO t FROM tenants WHERE code=c->>'tenant_id' AND status='active';
 IF t IS NULL THEN RAISE EXCEPTION 'Không có địa phương tiếp nhận' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM procedures WHERE id=p_procedure_id AND published)
  OR p_starts_at<=now()+interval '1 hour' OR p_ends_at<=p_starts_at
  OR p_ends_at>p_starts_at+interval '4 hours' OR p_capacity NOT BETWEEN 1 AND 200 THEN
  RAISE EXCEPTION 'Khung giờ không hợp lệ' USING ERRCODE='22023'; END IF;
 INSERT INTO citizen_counter_slots(tenant_id,procedure_id,starts_at,ends_at,capacity,published)
 VALUES(t,p_procedure_id,p_starts_at,p_ends_at,p_capacity,true)
 ON CONFLICT(tenant_id,procedure_id,starts_at) DO NOTHING
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Khung giờ đã tồn tại; không tự ý đổi sức chứa khi đang có lượt đăng ký' USING ERRCODE='22023'; END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION api.publish_counter_slot(text,timestamptz,timestamptz,integer) FROM PUBLIC;

CREATE OR REPLACE FUNCTION api.set_counter_ticket_status(p_booking_id uuid,p_status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
DECLARE t uuid; b record;
BEGIN
 IF NOT(coalesce(c->'realm_access'->'roles','[]'::jsonb) ?| ARRAY['receptionist','officer','leader']) THEN
  RAISE EXCEPTION 'Yêu cầu quyền cán bộ' USING ERRCODE='42501'; END IF;
 SELECT id INTO t FROM tenants WHERE code=c->>'tenant_id' AND status='active';
 IF t IS NULL THEN RAISE EXCEPTION 'Địa phương không hợp lệ' USING ERRCODE='42501'; END IF;
 SELECT b0.* INTO b FROM citizen_counter_bookings b0 JOIN citizen_counter_slots s ON s.id=b0.slot_id
 WHERE b0.id=p_booking_id AND s.tenant_id=t FOR UPDATE OF b0;
 IF b.id IS NULL THEN RETURN false; END IF;
 IF NOT ((b.status='booked' AND p_status IN ('checked_in','no_show'))
    OR (b.status='checked_in' AND p_status IN ('serving','no_show'))
    OR (b.status='serving' AND p_status='done')) THEN
  RAISE EXCEPTION 'Chuyển trạng thái số thứ tự không hợp lệ' USING ERRCODE='22023'; END IF;
 UPDATE citizen_counter_bookings SET status=p_status,updated_at=now() WHERE id=b.id;
 IF p_status='serving' THEN
  UPDATE citizen_counter_slots SET serving_ticket_no=b.ticket_number WHERE id=b.slot_id;
 ELSIF p_status='done' THEN
  UPDATE citizen_counter_slots SET serving_ticket_no=NULL
    WHERE id=b.slot_id AND serving_ticket_no=b.ticket_number;
 END IF;
 INSERT INTO citizen_notifications(citizen_id,tenant_id,category,title,body)
 VALUES(b.citizen_id,b.tenant_id,'appointment','Số thứ tự tiếp nhận đã cập nhật',
   'Số '||b.ticket_number||': '||(CASE p_status WHEN 'checked_in' THEN 'Đã đến quầy' WHEN 'serving' THEN 'Đang phục vụ' WHEN 'done' THEN 'Đã tiếp nhận' ELSE 'Vắng mặt' END)||'. Vui lòng xem mục Lịch tại quầy.');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION api.set_counter_ticket_status(uuid,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION api.record_citizen_case_stage(p_application_id text,p_stage_name text,p_stage_status text,p_unit_name text DEFAULT '',p_due_at timestamptz DEFAULT NULL,p_reason text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
DECLARE t uuid; a record; v_id uuid; old_due timestamptz;
BEGIN
 IF NOT(coalesce(c->'realm_access'->'roles','[]'::jsonb) ?| ARRAY['receptionist','officer','leader']) THEN
  RAISE EXCEPTION 'Yêu cầu quyền cán bộ' USING ERRCODE='42501'; END IF;
 SELECT id INTO t FROM tenants WHERE code=c->>'tenant_id' AND status='active';
 SELECT id,status INTO a FROM applications WHERE id=p_application_id AND coalesce(receiving_tenant_id,tenant_id)=t AND status<>'draft';
 IF a.id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ' USING ERRCODE='PT404'; END IF;
 IF length(btrim(coalesce(p_stage_name,''))) NOT BETWEEN 2 AND 120
  OR p_stage_status NOT IN ('pending','active','done','paused')
  OR length(coalesce(p_unit_name,''))>120 OR length(coalesce(p_reason,''))>500 THEN
  RAISE EXCEPTION 'Thông tin công đoạn không hợp lệ' USING ERRCODE='22023'; END IF;
 SELECT due_at INTO old_due FROM citizen_case_stage_updates
 WHERE application_id=p_application_id AND stage_name=p_stage_name ORDER BY created_at DESC,id DESC LIMIT 1;
 IF p_stage_status='paused' AND length(btrim(coalesce(p_reason,'')))<5 THEN
  RAISE EXCEPTION 'Tạm dừng công đoạn phải có lý do' USING ERRCODE='22023'; END IF;
 IF old_due IS NOT NULL AND p_due_at>old_due AND length(btrim(coalesce(p_reason,'')))<5 THEN
  RAISE EXCEPTION 'Kéo dài thời hạn phải có lý do' USING ERRCODE='22023'; END IF;
 INSERT INTO citizen_case_stage_updates(application_id,stage_name,unit_name,stage_status,due_at,reason,staff_name)
 VALUES(p_application_id,p_stage_name,coalesce(p_unit_name,''),p_stage_status,p_due_at,coalesce(p_reason,''),
  coalesce(c->>'name',c->>'preferred_username','Cán bộ')) RETURNING id INTO v_id;
 INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,category,title,body)
 SELECT citizen_id,tenant_id,id,'case','Cập nhật công đoạn xử lý',
  'Công đoạn '||p_stage_name||' đã được cập nhật. Xem chi tiết hồ sơ để biết tiến trình.'
 FROM applications WHERE id=a.id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION api.record_citizen_case_stage(text,text,text,text,timestamptz,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION api.request_citizen_case_supplement(p_application_id text,p_items jsonb,p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
DECLARE t uuid; a record; item jsonb; v_event bigint; v_count integer;
BEGIN
 IF NOT(coalesce(c->'realm_access'->'roles','[]'::jsonb) ?| ARRAY['receptionist','officer','leader']) THEN
  RAISE EXCEPTION 'Yêu cầu quyền cán bộ' USING ERRCODE='42501'; END IF;
 SELECT id INTO t FROM tenants WHERE code=c->>'tenant_id' AND status='active';
 SELECT * INTO a FROM applications WHERE id=p_application_id AND coalesce(receiving_tenant_id,tenant_id)=t
 AND status IN ('submitted','processing') FOR UPDATE;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ đủ điều kiện' USING ERRCODE='PT404'; END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Phải có danh sách yêu cầu' USING ERRCODE='22023'; END IF;
 v_count:=jsonb_array_length(p_items);
 IF v_count NOT BETWEEN 1 AND 12 OR length(coalesce(p_note,''))>500 THEN
  RAISE EXCEPTION 'Danh sách yêu cầu không hợp lệ' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF (item->>'kind') NOT IN ('document','field')
    OR (item->>'key') !~ '^[a-zA-Z][a-zA-Z0-9_-]{0,99}$'
    OR length(btrim(coalesce(item->>'instruction',''))) NOT BETWEEN 5 AND 500
    OR length(btrim(coalesce(item->>'reason',''))) NOT BETWEEN 5 AND 500 THEN
    RAISE EXCEPTION 'Thông tin một yêu cầu không hợp lệ' USING ERRCODE='22023'; END IF;
  IF item->>'kind'='document' AND NOT EXISTS(
    SELECT 1 FROM procedure_documents WHERE procedure_id=a.procedure_id AND document_code=item->>'key') THEN
    RAISE EXCEPTION 'Mã giấy tờ không thuộc thủ tục' USING ERRCODE='22023'; END IF;
  -- A field can be requested only if it is already present in the filed form; no arbitrary private keys.
  IF item->>'kind'='field' AND NOT(a.form_data ? (item->>'key')) THEN
    RAISE EXCEPTION 'Trường kê khai không thuộc hồ sơ' USING ERRCODE='22023'; END IF;
 END LOOP;
 UPDATE applications SET status='supplement',updated_at=now() WHERE id=a.id;
 INSERT INTO application_events(application_id,event_type,note,actor_name)
 VALUES(a.id,'supplement',coalesce(nullif(btrim(p_note),''),'Yêu cầu bổ sung thông tin theo danh sách'),
  coalesce(c->>'name',c->>'preferred_username','Cán bộ')) RETURNING id INTO v_event;
 INSERT INTO citizen_supplement_items(application_id,request_event_id,kind,target_key,instruction,reason)
 SELECT a.id,v_event,el->>'kind',el->>'key',el->>'instruction',el->>'reason'
 FROM jsonb_array_elements(p_items) el;
 INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,category,title,body)
 VALUES(a.citizen_id,a.tenant_id,a.id,'case','Cần bổ sung từng mục hồ sơ',
  'Hồ sơ '||a.id||' có '||v_count||' yêu cầu bổ sung. Vui lòng xem danh sách chi tiết.');
 RETURN jsonb_build_object('application_id',a.id,'items',v_count,'event_id',v_event);
END $$;
REVOKE ALL ON FUNCTION api.request_citizen_case_supplement(text,jsonb,text) FROM PUBLIC;

-- Staff can retrieve requests and citizen responses only for their receiving tenant.
CREATE OR REPLACE FUNCTION api.read_dossier_supplement(p_application_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
DECLARE t uuid; a record; result jsonb;
BEGIN
 IF NOT(coalesce(c->'realm_access'->'roles','[]'::jsonb) ?| ARRAY['receptionist','officer','leader']) THEN
  RAISE EXCEPTION 'Yêu cầu quyền cán bộ' USING ERRCODE='42501'; END IF;
 SELECT id INTO t FROM tenants WHERE code=c->>'tenant_id' AND status='active';
 SELECT id,status INTO a FROM applications WHERE id=p_application_id AND coalesce(receiving_tenant_id,tenant_id)=t AND status<>'draft';
 IF a.id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ' USING ERRCODE='PT404'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.created_at,v.id),'[]'::jsonb) INTO result
 FROM (SELECT i.id,i.kind,i.target_key,i.instruction,i.reason,i.citizen_response,
  i.document_id,i.responded_at,i.created_at
  FROM citizen_supplement_items i WHERE i.application_id=a.id
  AND i.request_event_id=(SELECT max(e.id) FROM application_events e
     WHERE e.application_id=a.id AND e.event_type='supplement')) v;
 RETURN coalesce(result,'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION api.read_dossier_supplement(text) FROM PUBLIC;

-- Staff receives queue metadata (no citizen identity fields) to check in and call tickets.
CREATE OR REPLACE FUNCTION api.list_counter_tickets(p_slot_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
DECLARE t uuid; result jsonb;
BEGIN
 IF NOT(coalesce(c->'realm_access'->'roles','[]'::jsonb) ?| ARRAY['receptionist','officer','leader']) THEN
  RAISE EXCEPTION 'Yêu cầu quyền cán bộ' USING ERRCODE='42501'; END IF;
 SELECT id INTO t FROM tenants WHERE code=c->>'tenant_id' AND status='active';
 IF NOT EXISTS(SELECT 1 FROM citizen_counter_slots WHERE id=p_slot_id AND tenant_id=t) THEN
  RAISE EXCEPTION 'Không tìm thấy khung giờ' USING ERRCODE='PT404'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(v) ORDER BY v.ticket_number),'[]'::jsonb) INTO result FROM
  (SELECT b.id,b.ticket_number,b.status,b.created_at FROM citizen_counter_bookings b
   WHERE b.slot_id=p_slot_id) v;
 RETURN coalesce(result,'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION api.list_counter_tickets(uuid) FROM PUBLIC;

-- Citizen may respond ONLY to current requests and cannot rewrite staff instructions.
CREATE OR REPLACE FUNCTION citizen_answer_supplement_item(p_item_id uuid,p_response text,p_document_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_citizen uuid:=nullif(current_setting('app.citizen_id',true),'')::uuid;
DECLARE v_tenant uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid;
DECLARE r record; v_last bigint;
BEGIN
 SELECT i.*,a.citizen_id,a.tenant_id,a.status INTO r FROM citizen_supplement_items i
 JOIN applications a ON a.id=i.application_id WHERE i.id=p_item_id FOR UPDATE OF i;
 IF r.id IS NULL OR v_citizen IS NULL OR r.citizen_id<>v_citizen OR r.tenant_id<>v_tenant OR r.status<>'supplement' THEN RETURN false; END IF;
 SELECT max(id) INTO v_last FROM application_events WHERE application_id=r.application_id AND event_type='supplement';
 IF v_last IS DISTINCT FROM r.request_event_id THEN RETURN false; END IF;
 IF r.kind='field' THEN
  IF length(btrim(coalesce(p_response,''))) NOT BETWEEN 2 AND 1000 OR p_document_id IS NOT NULL THEN RETURN false; END IF;
  UPDATE citizen_supplement_items SET citizen_response=btrim(p_response),responded_at=now() WHERE id=r.id;
 ELSE
  IF p_response IS NOT NULL OR p_document_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM application_documents d WHERE d.id=p_document_id AND d.application_id=r.application_id
      AND d.document_code=r.target_key AND d.uploaded_at>r.created_at) THEN RETURN false; END IF;
  UPDATE citizen_supplement_items SET document_id=p_document_id,responded_at=now() WHERE id=r.id;
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION citizen_answer_supplement_item(uuid,text,uuid) FROM PUBLIC;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
  GRANT SELECT ON citizen_counter_slots,citizen_counter_bookings,citizen_case_stage_updates,citizen_supplement_items TO communeos_app;
  GRANT EXECUTE ON FUNCTION citizen_cancel_counter_booking(uuid),citizen_book_counter_slot(uuid),
    citizen_counter_slot_remaining(uuid),citizen_answer_supplement_item(uuid,text,uuid) TO communeos_app;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='commune-app') THEN
  GRANT EXECUTE ON FUNCTION api.publish_counter_slot(text,timestamptz,timestamptz,integer),
    api.set_counter_ticket_status(uuid,text),api.record_citizen_case_stage(text,text,text,text,timestamptz,text),
    api.request_citizen_case_supplement(text,jsonb,text),api.read_dossier_supplement(text),
    api.list_counter_tickets(uuid) TO "commune-app";
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
