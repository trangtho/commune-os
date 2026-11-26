-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Citizen -> one-stop-counter handoff. A code never authorizes access on its own.
CREATE TABLE IF NOT EXISTS citizen_case_handoffs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 redeemed_at timestamptz,
 redeemed_by text,
 CHECK(expires_at > created_at),
 CHECK((redeemed_at IS NULL) = (redeemed_by IS NULL))
);
CREATE INDEX IF NOT EXISTS citizen_case_handoffs_owner_idx ON citizen_case_handoffs(citizen_id,tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS citizen_case_handoffs_case_idx ON citizen_case_handoffs(application_id,created_at DESC);
ALTER TABLE citizen_case_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_case_handoffs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_handoff_own_read ON citizen_case_handoffs;
CREATE POLICY citizen_handoff_own_read ON citizen_case_handoffs FOR SELECT
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id));
DROP POLICY IF EXISTS citizen_handoff_own_insert ON citizen_case_handoffs;
CREATE POLICY citizen_handoff_own_insert ON citizen_case_handoffs FOR INSERT
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
 AND redeemed_at IS NULL AND revoked_at IS NULL
 AND expires_at <= now()+interval '16 minutes'
 AND EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id AND a.status='draft'));
DROP POLICY IF EXISTS citizen_handoff_own_revoke ON citizen_case_handoffs;
CREATE POLICY citizen_handoff_own_revoke ON citizen_case_handoffs FOR UPDATE
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND redeemed_at IS NULL)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND redeemed_at IS NULL);

-- The counter's authenticated SERVER supplies staff identity, tenant, and a code.
-- The code is consumed atomically; the same code cannot be replayed by a second clerk.
CREATE OR REPLACE FUNCTION citizen_staff_redeem_handoff(p_hash text,p_tenant uuid,p_staff text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE h citizen_case_handoffs%ROWTYPE; a applications%ROWTYPE; payload jsonb;
BEGIN
 IF p_staff IS NULL OR char_length(btrim(p_staff)) NOT BETWEEN 2 AND 100 OR p_hash !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT * INTO h FROM citizen_case_handoffs WHERE code_hash=p_hash FOR UPDATE;
 IF NOT FOUND OR h.tenant_id<>p_tenant OR h.revoked_at IS NOT NULL OR h.redeemed_at IS NOT NULL OR h.expires_at<=now() THEN RETURN NULL; END IF;
 SELECT * INTO a FROM applications WHERE id=h.application_id FOR UPDATE;
 IF NOT FOUND OR a.status<>'draft' OR a.tenant_id<>p_tenant THEN RETURN NULL; END IF;
 UPDATE citizen_case_handoffs SET redeemed_at=now(),redeemed_by=p_staff WHERE id=h.id;
 INSERT INTO application_events(application_id,event_type,note,actor_name)
 VALUES(a.id,'handoff_claimed','Cán bộ tại quầy đã nhận mã chuyển tiếp và truy xuất dữ liệu nháp.',p_staff);
 INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,category,title,body)
 VALUES(a.citizen_id,a.tenant_id,a.id,'case','Hồ sơ đã được tiếp nhận để hỗ trợ tại quầy',
 'Mã chuyển tiếp của hồ sơ '||a.id||' đã được cán bộ sử dụng. Đây chưa phải xác nhận nộp hồ sơ chính thức.');
 SELECT jsonb_build_object(
   'handoffId',h.id,'application',jsonb_build_object(
     'id',a.id,'procedureId',a.procedure_id,'applicantName',a.applicant_name,
     'applicantPhone',a.applicant_phone,'description',a.description,'formData',a.form_data),
   'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'documentCode',d.document_code,
     'name',d.original_name,'mimeType',d.mime_type,'sizeBytes',d.size_bytes) ORDER BY d.uploaded_at)
     FROM application_documents d WHERE d.application_id=a.id),'[]'::jsonb)) INTO payload;
 RETURN payload;
END $$;
REVOKE ALL ON FUNCTION citizen_staff_redeem_handoff(text,uuid,text) FROM PUBLIC;

-- File download for the *same* clerk and tenant for up to 2 hours after code redemption.
CREATE OR REPLACE FUNCTION citizen_staff_handoff_document(p_handoff uuid,p_doc uuid,p_tenant uuid,p_staff text)
RETURNS TABLE(storage_key text,original_name text,mime_type text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT d.storage_key,d.original_name,d.mime_type FROM citizen_case_handoffs h
 JOIN application_documents d ON d.application_id=h.application_id
 WHERE h.id=p_handoff AND d.id=p_doc AND h.tenant_id=p_tenant AND h.redeemed_by=p_staff
   AND h.redeemed_at>now()-interval '2 hours' AND h.revoked_at IS NULL;
$$;
REVOKE ALL ON FUNCTION citizen_staff_handoff_document(uuid,uuid,uuid,text) FROM PUBLIC;

-- Support tickets are separate from one-off legacy feedback and scoped per citizen.
CREATE TABLE IF NOT EXISTS citizen_support_tickets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 legacy_feedback_id uuid UNIQUE REFERENCES citizen_feedback(id),
 application_id text REFERENCES applications(id) ON DELETE SET NULL,
 category text NOT NULL CHECK(category IN ('huong-dan','loi-ky-thuat','gop-y','phan-anh','khac')),
 subject text NOT NULL CHECK(char_length(btrim(subject)) BETWEEN 3 AND 150),
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','processing','waiting_citizen','answered','resolved','closed','reopened')),
 assigned_staff text,
 resolution text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citizen_support_tickets_owner_idx ON citizen_support_tickets(citizen_id,tenant_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS citizen_support_tickets_staff_idx ON citizen_support_tickets(tenant_id,status,updated_at DESC);
ALTER TABLE citizen_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_support_tickets FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_ticket_owner_read ON citizen_support_tickets;
CREATE POLICY citizen_ticket_owner_read ON citizen_support_tickets FOR SELECT
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS citizen_ticket_owner_create ON citizen_support_tickets;
CREATE POLICY citizen_ticket_owner_create ON citizen_support_tickets FOR INSERT
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND status='received'
 AND assigned_staff IS NULL AND resolution IS NULL
 AND (application_id IS NULL OR EXISTS(SELECT 1 FROM applications a WHERE a.id=application_id)));
CREATE TABLE IF NOT EXISTS citizen_support_ticket_events (
 id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
 ticket_id uuid NOT NULL REFERENCES citizen_support_tickets(id) ON DELETE CASCADE,
 actor_type text NOT NULL CHECK(actor_type IN ('citizen','staff','system')),
 actor_name text NOT NULL,
 event_type text NOT NULL CHECK(event_type IN ('message','status')),
 message text NOT NULL DEFAULT '',
 status text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(char_length(message)<=3000)
);
CREATE INDEX IF NOT EXISTS citizen_support_ticket_events_idx ON citizen_support_ticket_events(ticket_id,id);
ALTER TABLE citizen_support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_support_ticket_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_ticket_event_read ON citizen_support_ticket_events;
CREATE POLICY citizen_ticket_event_read ON citizen_support_ticket_events FOR SELECT
 USING(EXISTS(SELECT 1 FROM citizen_support_tickets t WHERE t.id=ticket_id));
DROP POLICY IF EXISTS citizen_ticket_event_create ON citizen_support_ticket_events;
CREATE POLICY citizen_ticket_event_create ON citizen_support_ticket_events FOR INSERT
 WITH CHECK(actor_type='citizen' AND event_type='message' AND status IS NULL
 AND EXISTS(SELECT 1 FROM citizen_support_tickets t WHERE t.id=ticket_id));
-- Client reopens a closed/resolved ticket or responds to a staff request via validated RPC.
CREATE OR REPLACE FUNCTION citizen_reply_support_ticket(p_ticket uuid,p_text text,p_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE t citizen_support_tickets%ROWTYPE; v_citizen uuid:=nullif(current_setting('app.citizen_id',true),'')::uuid;
 v_tenant uuid:=nullif(current_setting('app.tenant_id',true),'')::uuid; v_status text;
BEGIN
 IF char_length(btrim(coalesce(p_text,''))) NOT BETWEEN 5 AND 3000 THEN RETURN NULL; END IF;
 SELECT * INTO t FROM citizen_support_tickets WHERE id=p_ticket FOR UPDATE;
 IF NOT FOUND OR t.citizen_id IS DISTINCT FROM v_citizen OR t.tenant_id IS DISTINCT FROM v_tenant THEN RETURN NULL; END IF;
 v_status:=CASE WHEN t.status IN ('answered','resolved','closed') THEN 'reopened'
                WHEN t.status='waiting_citizen' THEN 'processing' ELSE t.status END;
 UPDATE citizen_support_tickets SET status=v_status,
   resolution=CASE WHEN v_status='reopened' THEN NULL ELSE resolution END,updated_at=now() WHERE id=p_ticket;
 INSERT INTO citizen_support_ticket_events(ticket_id,actor_type,actor_name,event_type,message)
 VALUES(p_ticket,'citizen',left(coalesce(p_name,'Công dân'),120),'message',btrim(p_text));
 RETURN v_status;
END $$;
REVOKE ALL ON FUNCTION citizen_reply_support_ticket(uuid,text,text) FROM PUBLIC;

-- Trusted staff bridge only: never expose this as a citizen API or a public credential.
CREATE OR REPLACE FUNCTION citizen_staff_support_tickets(p_tenant uuid,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]'::jsonb) FROM (
 SELECT id,category,subject,status,assigned_staff,created_at,updated_at,application_id
 FROM citizen_support_tickets WHERE tenant_id=p_tenant
 ORDER BY updated_at DESC LIMIT LEAST(GREATEST(p_limit,1),100)) x;
$$;
REVOKE ALL ON FUNCTION citizen_staff_support_tickets(uuid,integer) FROM PUBLIC;
CREATE OR REPLACE FUNCTION citizen_staff_support_ticket_detail(p_id uuid,p_tenant uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',t.id,'category',t.category,'subject',t.subject,'status',t.status,
    'applicationId',t.application_id,'assignedStaff',t.assigned_staff,'resolution',t.resolution,
    'createdAt',t.created_at,'updatedAt',t.updated_at,
    'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'actorType',e.actor_type,
       'actorName',e.actor_name,'eventType',e.event_type,'message',e.message,'status',e.status,
       'createdAt',e.created_at) ORDER BY e.id) FROM citizen_support_ticket_events e
       WHERE e.ticket_id=t.id),'[]'::jsonb))
 FROM citizen_support_tickets t WHERE t.id=p_id AND t.tenant_id=p_tenant;
$$;
REVOKE ALL ON FUNCTION citizen_staff_support_ticket_detail(uuid,uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION citizen_staff_update_support_ticket(p_ticket uuid,p_tenant uuid,p_staff text,
 p_status text,p_message text,p_resolution text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE t citizen_support_tickets%ROWTYPE;
BEGIN
 IF char_length(btrim(coalesce(p_staff,''))) NOT BETWEEN 2 AND 100
 OR p_status NOT IN ('processing','waiting_citizen','answered','resolved','closed')
 OR char_length(coalesce(p_message,''))>3000 OR char_length(coalesce(p_resolution,''))>2000 THEN RETURN false; END IF;
 SELECT * INTO t FROM citizen_support_tickets WHERE id=p_ticket AND tenant_id=p_tenant FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE citizen_support_tickets SET status=p_status,assigned_staff=p_staff,
   resolution=CASE WHEN p_status IN ('resolved','closed') THEN nullif(btrim(p_resolution),'') ELSE resolution END,
   updated_at=now() WHERE id=p_ticket;
 IF btrim(coalesce(p_message,''))<>'' THEN
   INSERT INTO citizen_support_ticket_events(ticket_id,actor_type,actor_name,event_type,message)
   VALUES(p_ticket,'staff',p_staff,'message',btrim(p_message));
 END IF;
 INSERT INTO citizen_support_ticket_events(ticket_id,actor_type,actor_name,event_type,message,status)
 VALUES(p_ticket,'staff',p_staff,'status','Đã cập nhật trạng thái yêu cầu.',p_status);
 INSERT INTO citizen_notifications(citizen_id,tenant_id,category,title,body)
 VALUES(t.citizen_id,t.tenant_id,'support','Yêu cầu hỗ trợ đã được cập nhật',
 'Yêu cầu "'||left(t.subject,80)||'" được cập nhật. Mở Trung tâm hỗ trợ để xem phản hồi.');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION citizen_staff_update_support_ticket(uuid,uuid,text,text,text,text) FROM PUBLIC;

-- Migrate existing feedback into the new tracking system without removing old records.
INSERT INTO citizen_support_tickets(citizen_id,tenant_id,legacy_feedback_id,category,subject,created_at,updated_at)
 SELECT f.citizen_id,f.tenant_id,f.id,'khac',left(f.subject,150),f.created_at,f.created_at
 FROM citizen_feedback f ON CONFLICT(legacy_feedback_id) DO NOTHING;
INSERT INTO citizen_support_ticket_events(ticket_id,actor_type,actor_name,event_type,message,created_at)
 SELECT t.id,'citizen','Công dân','message',left(f.message,3000),f.created_at
 FROM citizen_support_tickets t JOIN citizen_feedback f ON f.id=t.legacy_feedback_id
 WHERE NOT EXISTS(SELECT 1 FROM citizen_support_ticket_events e WHERE e.ticket_id=t.id);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
  GRANT SELECT,INSERT,UPDATE(revoked_at) ON citizen_case_handoffs TO communeos_app;
  GRANT EXECUTE ON FUNCTION citizen_staff_redeem_handoff(text,uuid,text) TO communeos_app;
  GRANT EXECUTE ON FUNCTION citizen_staff_handoff_document(uuid,uuid,uuid,text) TO communeos_app;
  GRANT SELECT,INSERT ON citizen_support_tickets TO communeos_app;
  GRANT SELECT,INSERT ON citizen_support_ticket_events TO communeos_app;
  GRANT USAGE,SELECT ON SEQUENCE citizen_support_ticket_events_id_seq TO communeos_app;
  GRANT EXECUTE ON FUNCTION citizen_reply_support_ticket(uuid,text,text) TO communeos_app;
  GRANT EXECUTE ON FUNCTION citizen_staff_support_tickets(uuid,integer) TO communeos_app;
  GRANT EXECUTE ON FUNCTION citizen_staff_support_ticket_detail(uuid,uuid) TO communeos_app;
  GRANT EXECUTE ON FUNCTION citizen_staff_update_support_ticket(uuid,uuid,text,text,text,text) TO communeos_app;
 END IF;
END $$;
