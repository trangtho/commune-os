-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Citizen portal: published procedure provenance, draft impact, privacy transparency and retention review.
-- Idempotent schema migration; no destructive backfill or automatic deletion.

CREATE TABLE IF NOT EXISTS citizen_procedure_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id text NOT NULL REFERENCES procedures(id),
  version_no integer NOT NULL CHECK (version_no >= 1),
  effective_from date NOT NULL,
  source_url text,
  source_title text,
  source_reference text,
  issuing_authority text,
  scope_note text NOT NULL DEFAULT 'Chưa xác định phạm vi áp dụng',
  provenance_status text NOT NULL CHECK (provenance_status IN ('unverified_demo','staff_declared')),
  change_sections text[] NOT NULL DEFAULT '{}'::text[],
  change_note text NOT NULL DEFAULT '',
  snapshot jsonb NOT NULL,
  published_by text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (procedure_id, version_no)
);
CREATE INDEX IF NOT EXISTS citizen_procedure_version_lookup ON citizen_procedure_versions(procedure_id, version_no DESC);
-- Legacy demo catalog has no authenticated legal source: never fabricate one.
INSERT INTO citizen_procedure_versions(procedure_id,version_no,effective_from,provenance_status,
  snapshot,published_by,change_note)
SELECT p.id,1,CURRENT_DATE,'unverified_demo',
 jsonb_build_object('title',p.title,'summary',p.summary,'instructions',p.instructions,
  'feeNote',p.fee_note,'slaDays',p.sla_days,'formRevision','legacy',
  'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('documentCode',d.document_code,
  'documentName',d.document_name,'isRequired',d.is_required) ORDER BY d.document_code)
  FROM procedure_documents d WHERE d.procedure_id=p.id),'[]'::jsonb)),
 'legacy-import','Bản dữ liệu mô phỏng ban đầu; chưa xác minh nguồn pháp lý'
FROM procedures p WHERE NOT EXISTS (
 SELECT 1 FROM citizen_procedure_versions v WHERE v.procedure_id=p.id);

ALTER TABLE applications ADD COLUMN IF NOT EXISTS procedure_version_id uuid REFERENCES citizen_procedure_versions(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS acknowledged_procedure_version_id uuid REFERENCES citizen_procedure_versions(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS submitted_procedure_version_id uuid REFERENCES citizen_procedure_versions(id);
UPDATE applications a SET procedure_version_id=v.id,
 acknowledged_procedure_version_id=CASE WHEN a.status='draft' THEN v.id ELSE a.acknowledged_procedure_version_id END,
 submitted_procedure_version_id=CASE WHEN a.status='draft' THEN a.submitted_procedure_version_id ELSE v.id END
FROM citizen_procedure_versions v
WHERE v.procedure_id=a.procedure_id AND v.version_no=1 AND a.procedure_version_id IS NULL;

CREATE TABLE IF NOT EXISTS citizen_procedure_change_notices (
 application_id text NOT NULL REFERENCES applications(id),
 version_id uuid NOT NULL REFERENCES citizen_procedure_versions(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(application_id,version_id)
);

-- Staff-only bridge calls this function; app role cannot UPDATE procedure catalog directly.
CREATE OR REPLACE FUNCTION citizen_publish_procedure_version(p_procedure text,p_data jsonb,p_staff text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE old_v citizen_procedure_versions%ROWTYPE;
 v_procedure procedures%ROWTYPE;
 v_snapshot jsonb;
 v_change text[];
 v_id uuid;
 v_doc jsonb;
BEGIN
 SELECT * INTO v_procedure FROM procedures WHERE id=p_procedure AND published FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or unpublished procedure' USING ERRCODE='22023'; END IF;
 SELECT * INTO old_v FROM citizen_procedure_versions WHERE procedure_id=p_procedure ORDER BY version_no DESC LIMIT 1;
 IF (p_data->>'sourceUrl') !~* '^https://([a-z0-9-]+\.)*(gov\.vn|chinhphu\.vn|vbpl\.vn)([:/]|$)'
   OR length(p_data->>'sourceUrl')>2000
   OR length(trim(p_data->>'issuingAuthority'))<3 OR length(trim(p_data->>'sourceReference'))<3
   OR (p_data->>'effectiveFrom')::date>CURRENT_DATE
 THEN RAISE EXCEPTION 'Invalid legal provenance or future effective date' USING ERRCODE='22023'; END IF;
 v_snapshot=jsonb_build_object('title',p_data->>'title','summary',p_data->>'summary',
  'instructions',p_data->>'instructions','feeNote',p_data->>'feeNote',
  'slaDays',(p_data->>'slaDays')::integer,'formRevision',p_data->>'formRevision',
  'documents',p_data->'documents');
 IF old_v.snapshot=v_snapshot AND old_v.source_url=p_data->>'sourceUrl'
   AND old_v.source_reference=p_data->>'sourceReference'
 THEN RAISE EXCEPTION 'No change to publish' USING ERRCODE='22023'; END IF;
 v_change=array_remove(ARRAY[
   CASE WHEN old_v.snapshot->'documents' IS DISTINCT FROM v_snapshot->'documents' THEN 'documents' END,
   CASE WHEN old_v.snapshot->>'feeNote' IS DISTINCT FROM v_snapshot->>'feeNote' THEN 'fees' END,
   CASE WHEN old_v.snapshot->>'slaDays' IS DISTINCT FROM v_snapshot->>'slaDays' THEN 'deadline' END,
   CASE WHEN old_v.snapshot->>'formRevision' IS DISTINCT FROM v_snapshot->>'formRevision' THEN 'forms' END,
   CASE WHEN old_v.snapshot->>'instructions' IS DISTINCT FROM v_snapshot->>'instructions' THEN 'conditions' END,
   CASE WHEN old_v.source_url IS DISTINCT FROM p_data->>'sourceUrl' OR
     old_v.source_reference IS DISTINCT FROM p_data->>'sourceReference' THEN 'source' END,
   CASE WHEN old_v.snapshot->>'title' IS DISTINCT FROM v_snapshot->>'title' OR
     old_v.snapshot->>'summary' IS DISTINCT FROM v_snapshot->>'summary' THEN 'description' END,
   CASE WHEN old_v.scope_note IS DISTINCT FROM p_data->>'scopeNote' THEN 'scope' END
 ],NULL);
 INSERT INTO citizen_procedure_versions(procedure_id,version_no,effective_from,source_url,source_title,
 source_reference,issuing_authority,scope_note,provenance_status,change_sections,change_note,snapshot,published_by)
 VALUES(p_procedure,old_v.version_no+1,(p_data->>'effectiveFrom')::date,p_data->>'sourceUrl',
 p_data->>'sourceTitle',p_data->>'sourceReference',p_data->>'issuingAuthority',p_data->>'scopeNote',
 'staff_declared',v_change,COALESCE(p_data->>'changeNote',''),v_snapshot,p_staff) RETURNING id INTO v_id;
 UPDATE procedures SET title=p_data->>'title',summary=p_data->>'summary',
  instructions=p_data->>'instructions',fee_note=p_data->>'feeNote',
  sla_days=(p_data->>'slaDays')::integer WHERE id=p_procedure;
 DELETE FROM procedure_documents WHERE procedure_id=p_procedure;
 FOR v_doc IN SELECT value FROM jsonb_array_elements(p_data->'documents') LOOP
  INSERT INTO procedure_documents(procedure_id,document_code,document_name,is_required)
   VALUES(p_procedure,v_doc->>'documentCode',v_doc->>'documentName',(v_doc->>'isRequired')::boolean);
 END LOOP;
 WITH pending AS (
  INSERT INTO citizen_procedure_change_notices(application_id,version_id)
  SELECT a.id,v_id FROM applications a WHERE a.procedure_id=p_procedure AND a.status='draft'
    AND a.acknowledged_procedure_version_id IS DISTINCT FROM v_id
  ON CONFLICT DO NOTHING RETURNING application_id
 )
 INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body,category)
 SELECT a.citizen_id,a.tenant_id,a.id,'Thủ tục đã thay đổi quy định',
  'Bản nháp '||a.id||' cần kiểm tra lại phiên bản '||(old_v.version_no+1)::text||
  ' trước khi nộp. Phần thay đổi: '||array_to_string(v_change,', ')||'.','procedure_change'
 FROM pending JOIN applications a ON a.id=pending.application_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION citizen_publish_procedure_version(text,jsonb,text) FROM PUBLIC;

-- Named processing purposes distinguish consent-based operations from other declared bases.
CREATE TABLE IF NOT EXISTS citizen_processing_purposes (
 id text PRIMARY KEY,
 title text NOT NULL,
 description text NOT NULL,
 legal_basis text NOT NULL CHECK (legal_basis IN ('consent','other_legal_basis')),
 basis_explanation text NOT NULL,
 categories text[] NOT NULL,
 recipients text NOT NULL,
 validity_days integer CHECK(validity_days BETWEEN 1 AND 3650),
 published boolean NOT NULL DEFAULT false
);
INSERT INTO citizen_processing_purposes(id,title,description,legal_basis,basis_explanation,categories,recipients,validity_days,published)
VALUES
('vault_case_reuse','Tái sử dụng giấy tờ trong hồ sơ mới',
 'Cho phép chọn giấy tờ trong kho để tạo bản sao đính kèm vào hồ sơ bạn đang chuẩn bị.',
 'consent','Chỉ thực hiện khi bạn đồng ý và xác nhận riêng cho mỗi lần đính kèm.',
 ARRAY['Giấy tờ tải lên','Mã hồ sơ nhận'],'Bộ phận giải quyết hồ sơ được chọn',180,true),
('case_required_processing','Xử lý hồ sơ hành chính đã nộp (minh họa)',
 'Thông tin hồ sơ có thể cần được xử lý theo căn cứ pháp lý ngoài sự đồng ý.',
 'other_legal_basis','Căn cứ và thời hạn cụ thể cần cơ quan triển khai thẩm định; không có nút rút đồng ý cho hoạt động này.',
 ARRAY['Thông tin đơn','Tài liệu đính kèm'],'Cơ quan tiếp nhận có thẩm quyền',NULL,true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS citizen_consent_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 purpose_id text NOT NULL REFERENCES citizen_processing_purposes(id),
 decision text NOT NULL CHECK(decision IN ('granted','withdrawn')),
 valid_until timestamptz,
 decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((decision='granted' AND valid_until IS NOT NULL) OR
       (decision='withdrawn' AND valid_until IS NULL))
);
CREATE INDEX IF NOT EXISTS citizen_consent_recent_idx ON citizen_consent_events(citizen_id,purpose_id,id DESC);
ALTER TABLE citizen_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_consent_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_consent_owner ON citizen_consent_events;
CREATE POLICY citizen_consent_owner ON citizen_consent_events FOR SELECT
 USING (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS citizen_consent_insert_owner ON citizen_consent_events;
CREATE POLICY citizen_consent_insert_owner ON citizen_consent_events FOR INSERT
 WITH CHECK (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

-- Append-only, per-citizen chained digest. Only non-sensitive purpose metadata is logged.
CREATE TABLE IF NOT EXISTS citizen_data_access_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 seq_no bigint NOT NULL CHECK(seq_no>=1),
 action text NOT NULL,
 purpose text NOT NULL,
 processing_unit text NOT NULL,
 resource_kind text NOT NULL,
 resource_reference text NOT NULL DEFAULT '',
 actor_kind text NOT NULL CHECK(actor_kind IN ('citizen','system','authorized_unit')),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 previous_hash text NOT NULL DEFAULT '',
 event_hash text NOT NULL DEFAULT '',
 UNIQUE(citizen_id,seq_no)
);
CREATE INDEX IF NOT EXISTS citizen_data_access_owner_idx ON citizen_data_access_events(citizen_id,seq_no DESC);
ALTER TABLE citizen_data_access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_data_access_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_data_access_owner ON citizen_data_access_events;
CREATE POLICY citizen_data_access_owner ON citizen_data_access_events FOR SELECT
 USING (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS citizen_data_access_insert_owner ON citizen_data_access_events;
CREATE POLICY citizen_data_access_insert_owner ON citizen_data_access_events FOR INSERT
 WITH CHECK (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE OR REPLACE FUNCTION citizen_data_event_digest(
 p_citizen uuid,p_tenant uuid,p_action text,p_purpose text,p_unit text,
 p_kind text,p_resource text,p_actor text,p_at timestamptz,p_previous text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
 SELECT encode(digest(jsonb_build_object('citizen',p_citizen,'tenant',p_tenant,'action',p_action,
  'purpose',p_purpose,'unit',p_unit,'kind',p_kind,'resource',p_resource,
  'actor',p_actor,'occurredEpochMicros',round(extract(epoch from p_at)*1000000)::bigint,'prev',p_previous)::text,'sha256'),'hex');
$$;
CREATE OR REPLACE FUNCTION citizen_data_event_append() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_previous text; v_prev_seq bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(NEW.citizen_id::text));
 SELECT event_hash,seq_no INTO v_previous,v_prev_seq FROM citizen_data_access_events
 WHERE citizen_id=NEW.citizen_id ORDER BY seq_no DESC LIMIT 1;
 NEW.seq_no=COALESCE(v_prev_seq,0)+1;
 NEW.previous_hash=COALESCE(v_previous,'');
 NEW.event_hash=citizen_data_event_digest(NEW.citizen_id,NEW.tenant_id,NEW.action,NEW.purpose,
   NEW.processing_unit,NEW.resource_kind,NEW.resource_reference,NEW.actor_kind,NEW.occurred_at,NEW.previous_hash);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS citizen_data_append ON citizen_data_access_events;
CREATE TRIGGER citizen_data_append BEFORE INSERT ON citizen_data_access_events
 FOR EACH ROW EXECUTE FUNCTION citizen_data_event_append();
CREATE OR REPLACE FUNCTION citizen_privacy_no_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only history cannot be modified'; END $$;
DROP TRIGGER IF EXISTS citizen_data_immutable ON citizen_data_access_events;
CREATE TRIGGER citizen_data_immutable BEFORE UPDATE OR DELETE ON citizen_data_access_events
 FOR EACH ROW EXECUTE FUNCTION citizen_privacy_no_mutation();
DROP TRIGGER IF EXISTS citizen_consent_immutable ON citizen_consent_events;
CREATE TRIGGER citizen_consent_immutable BEFORE UPDATE OR DELETE ON citizen_consent_events
 FOR EACH ROW EXECUTE FUNCTION citizen_privacy_no_mutation();
DROP TRIGGER IF EXISTS citizen_procedure_version_immutable ON citizen_procedure_versions;
CREATE TRIGGER citizen_procedure_version_immutable BEFORE UPDATE OR DELETE ON citizen_procedure_versions
 FOR EACH ROW EXECUTE FUNCTION citizen_privacy_no_mutation();

-- Retention is review-first: no destructive action until an approved legal policy exists.
CREATE TABLE IF NOT EXISTS citizen_retention_policies (
 id text PRIMARY KEY,
 resource_kind text NOT NULL,
 title text NOT NULL,
 description text NOT NULL,
 retention_days integer CHECK (retention_days > 0),
 legal_reference text NOT NULL,
 approved boolean NOT NULL DEFAULT false,
 automatic_action text NOT NULL DEFAULT 'review' CHECK(automatic_action IN ('review','restrict'))
);
INSERT INTO citizen_retention_policies(id,resource_kind,title,description,retention_days,legal_reference,approved)
VALUES
('vault-expiry','vault_version','Giấy tờ số hết hiệu lực','Tạm ngừng tái sử dụng khi giấy tờ hết hạn và chuyển vào danh sách cần xem xét.',NULL,'Chỉ dựa vào ngày hết hạn do công dân khai; không phải hạn lưu trữ pháp định.',true),
('case-retention','application','Hồ sơ đã nộp','Hạn bảo quản hồ sơ phải được cơ quan có thẩm quyền phê duyệt trước khi tự động xử lý.',NULL,'Chưa cấu hình văn bản và thời hạn bảo quản.',false),
('access-log-retention','access_log','Nhật ký truy cập dữ liệu','Giữ phục vụ minh bạch; thời hạn chính thức chưa xác lập.',NULL,'Chưa được phê duyệt.',false),
('notice-retention','notification','Thông báo công dân','Chỉ lập danh sách xem xét khi có chính sách được phê duyệt.',NULL,'Chưa được phê duyệt.',false)
ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS citizen_retention_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 policy_id text NOT NULL REFERENCES citizen_retention_policies(id),
 resource_kind text NOT NULL,
 resource_reference text NOT NULL,
 state text NOT NULL DEFAULT 'review_due' CHECK(state IN ('review_due','restricted','archived','keep')),
 found_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 decision_note text,
 UNIQUE(citizen_id,policy_id,resource_reference)
);
ALTER TABLE citizen_retention_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_retention_reviews FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_retention_owner ON citizen_retention_reviews;
CREATE POLICY citizen_retention_owner ON citizen_retention_reviews FOR SELECT
 USING (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
CREATE TABLE IF NOT EXISTS citizen_data_rights_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 request_type text NOT NULL CHECK(request_type IN ('access','correct','restrict','erase','retention_review')),
 details text NOT NULL CHECK(length(details) BETWEEN 10 AND 2000),
 state text NOT NULL DEFAULT 'received' CHECK(state IN ('received','reviewing','resolved','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 resolution_note text
);
ALTER TABLE citizen_data_rights_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_data_rights_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_rights_owner ON citizen_data_rights_requests;
CREATE POLICY citizen_rights_owner ON citizen_data_rights_requests FOR SELECT
 USING (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS citizen_rights_insert ON citizen_data_rights_requests;
CREATE POLICY citizen_rights_insert ON citizen_data_rights_requests FOR INSERT
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE OR REPLACE FUNCTION citizen_staff_scan_retention(p_tenant uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count integer;
BEGIN
 WITH newly_due AS (
  INSERT INTO citizen_retention_reviews(citizen_id,tenant_id,policy_id,resource_kind,resource_reference)
  SELECT d.citizen_id,d.tenant_id,'vault-expiry','vault_version',v.id::text
  FROM citizen_vault_versions v JOIN citizen_vault_documents d ON d.id=v.document_id
  WHERE d.tenant_id=p_tenant AND v.expires_on<CURRENT_DATE
  UNION ALL
  SELECT a.citizen_id,a.tenant_id,'case-retention','application',a.id
  FROM applications a CROSS JOIN citizen_retention_policies p
  WHERE a.tenant_id=p_tenant AND p.id='case-retention' AND p.approved AND p.retention_days IS NOT NULL
   AND a.status IN ('completed','rejected','withdrawn')
   AND a.submitted_at IS NOT NULL AND a.submitted_at < now() - (p.retention_days * interval '1 day')
  ON CONFLICT DO NOTHING RETURNING citizen_id,tenant_id,resource_reference
 ), notices AS (
  INSERT INTO citizen_notifications(citizen_id,tenant_id,title,body,category)
  SELECT citizen_id,tenant_id,'Dữ liệu đến hạn xem xét',
  'Một mục dữ liệu đã đến mốc cần xem xét. Vui lòng mở trang Vòng đời dữ liệu.','retention'
  FROM newly_due RETURNING id
 ) SELECT count(*) INTO v_count FROM notices;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION citizen_staff_scan_retention(uuid) FROM PUBLIC;

-- Authorized staff can review requests. The decision is NOT itself a destructive operation.
CREATE OR REPLACE FUNCTION citizen_staff_review_privacy_request(
 p_id uuid,p_tenant uuid,p_staff text,p_state text,p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_citizen uuid; v_count integer;
BEGIN
 IF p_state NOT IN ('reviewing','resolved','declined') OR length(trim(p_note))<5 THEN
  RAISE EXCEPTION 'Invalid privacy request resolution' USING ERRCODE='22023'; END IF;
 UPDATE citizen_data_rights_requests SET state=p_state,resolution_note=p_note,
 processed_at=CASE WHEN p_state='reviewing' THEN NULL ELSE now() END
 WHERE id=p_id AND tenant_id=p_tenant AND state IN ('received','reviewing')
 RETURNING citizen_id INTO v_citizen;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RETURN false; END IF;
 INSERT INTO citizen_data_access_events(citizen_id,tenant_id,action,purpose,
  processing_unit,resource_kind,resource_reference,actor_kind)
 VALUES(v_citizen,p_tenant,'privacy_request_reviewed','Xử lý yêu cầu dữ liệu cá nhân',
  'Bộ phận tiếp nhận được phân quyền','privacy_request',p_id::text,'authorized_unit');
 INSERT INTO citizen_notifications(citizen_id,tenant_id,title,body,category)
 VALUES(v_citizen,p_tenant,'Yêu cầu dữ liệu đã cập nhật',
  'Yêu cầu '||p_id::text||' hiện ở trạng thái: '||p_state||'.','privacy');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION citizen_staff_review_privacy_request(uuid,uuid,text,text,text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION citizen_staff_review_retention(
 p_id uuid,p_tenant uuid,p_staff text,p_state text,p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_citizen uuid; v_resource text; v_count integer;
BEGIN
 IF p_state NOT IN ('restricted','archived','keep') OR length(trim(p_note))<5 THEN
  RAISE EXCEPTION 'Invalid retention review decision' USING ERRCODE='22023'; END IF;
 UPDATE citizen_retention_reviews SET state=p_state,decided_at=now(),decision_note=p_note
 WHERE id=p_id AND tenant_id=p_tenant AND state='review_due'
 RETURNING citizen_id,resource_reference INTO v_citizen,v_resource;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RETURN false; END IF;
 INSERT INTO citizen_data_access_events(citizen_id,tenant_id,action,purpose,
  processing_unit,resource_kind,resource_reference,actor_kind)
 VALUES(v_citizen,p_tenant,'retention_decided','Quyết định lưu trữ dữ liệu',
  'Bộ phận tiếp nhận được phân quyền','retention_review',p_id::text,'authorized_unit');
 INSERT INTO citizen_notifications(citizen_id,tenant_id,title,body,category)
 VALUES(v_citizen,p_tenant,'Quyết định về vòng đời dữ liệu',
  'Một mục dữ liệu đã được xem xét. Trạng thái: '||p_state||'.','retention');
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION citizen_staff_review_retention(uuid,uuid,text,text,text) FROM PUBLIC;

-- Read-only staff queue endpoints use tenant-scoped SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION citizen_staff_privacy_queue(p_tenant uuid)
RETURNS TABLE(id uuid,citizen_id uuid,request_type text,details text,state text,
 created_at timestamptz,processed_at timestamptz,resolution_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT r.id,r.citizen_id,r.request_type,r.details,r.state,r.created_at,r.processed_at,r.resolution_note
 FROM citizen_data_rights_requests r WHERE r.tenant_id=p_tenant ORDER BY r.created_at DESC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION citizen_staff_privacy_queue(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION citizen_staff_retention_queue(p_tenant uuid)
RETURNS TABLE(id uuid,citizen_id uuid,policy_id text,resource_kind text,resource_reference text,
 state text,found_at timestamptz,decided_at timestamptz,decision_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT r.id,r.citizen_id,r.policy_id,r.resource_kind,r.resource_reference,
 r.state,r.found_at,r.decided_at,r.decision_note
 FROM citizen_retention_reviews r WHERE r.tenant_id=p_tenant ORDER BY r.found_at DESC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION citizen_staff_retention_queue(uuid) FROM PUBLIC;

-- Privileges deliberately scoped to citizen reads/inserts, not administrative mutation.
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
 GRANT SELECT ON citizen_procedure_versions,citizen_processing_purposes,citizen_retention_policies TO communeos_app;
 GRANT SELECT,INSERT ON citizen_consent_events,citizen_data_access_events,citizen_data_rights_requests TO communeos_app;
 GRANT SELECT ON citizen_retention_reviews TO communeos_app;
 GRANT UPDATE (acknowledged_procedure_version_id,submitted_procedure_version_id) ON applications TO communeos_app;
 GRANT EXECUTE ON FUNCTION citizen_publish_procedure_version(text,jsonb,text),citizen_staff_scan_retention(uuid),
 citizen_staff_review_privacy_request(uuid,uuid,text,text,text),citizen_staff_review_retention(uuid,uuid,text,text,text),
 citizen_staff_privacy_queue(uuid),citizen_staff_retention_queue(uuid) TO communeos_app;
 GRANT EXECUTE ON FUNCTION citizen_data_event_digest(uuid,uuid,text,text,text,text,text,text,timestamptz,text) TO communeos_app;
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO communeos_app;
END IF; END $$;
