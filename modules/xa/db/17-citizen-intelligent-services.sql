-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Additive migration: result lookup, transaction intelligence, consented sync, OCR observations.
-- Do NOT remove or overwrite existing documents / legal records.
CREATE TABLE IF NOT EXISTS citizen_result_verifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 application_id text NOT NULL REFERENCES applications(id),
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 document_sha256 text NOT NULL CHECK(document_sha256 ~ '^[0-9a-f]{64}$'),
 result_reference text NOT NULL DEFAULT '',
 provider_verification text NOT NULL CHECK(provider_verification='verified'),
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at>issued_at)
);
CREATE INDEX IF NOT EXISTS citizen_result_verification_owner ON citizen_result_verifications(citizen_id,application_id,issued_at DESC);
ALTER TABLE citizen_result_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_result_verifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_result_verification_owned ON citizen_result_verifications;
CREATE POLICY citizen_result_verification_owned ON citizen_result_verifications FOR ALL
 USING (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

-- Only minimal, token-holder-visible proof. No names, identifiers or document contents.
CREATE OR REPLACE FUNCTION citizen_verify_result_public(p_hash text)
RETURNS TABLE(application_id text,document_sha256 text,reference_code text,provider_status text,
 active boolean,issued_at timestamptz,expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT v.application_id,v.document_sha256,v.result_reference,v.provider_verification,
  (v.revoked_at IS NULL AND v.expires_at>now() AND a.status='completed'),v.issued_at,v.expires_at
 FROM citizen_result_verifications v JOIN applications a ON a.id=v.application_id
 WHERE v.token_hash=p_hash AND length(p_hash)=64 LIMIT 1;
$$;
REVOKE ALL ON FUNCTION citizen_verify_result_public(text) FROM PUBLIC;

CREATE TABLE IF NOT EXISTS citizen_sync_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 source_tenant_id uuid NOT NULL REFERENCES tenants(id),
 target_tenant_id uuid NOT NULL REFERENCES tenants(id),
 payload jsonb NOT NULL,
 provenance text NOT NULL DEFAULT 'self_declared',
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','reviewed','rejected','cancelled')),
 consent_confirmed_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 review_note text,
 CHECK(source_tenant_id<>target_tenant_id),
 CHECK(jsonb_typeof(payload)='object')
);
CREATE INDEX IF NOT EXISTS citizen_sync_requests_owner_idx ON citizen_sync_requests(citizen_id,created_at DESC);
ALTER TABLE citizen_sync_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_sync_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_sync_requests_owner ON citizen_sync_requests;
CREATE POLICY citizen_sync_requests_owner ON citizen_sync_requests FOR SELECT
 USING (citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND source_tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS citizen_sync_requests_insert ON citizen_sync_requests;
CREATE POLICY citizen_sync_requests_insert ON citizen_sync_requests FOR INSERT
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND source_tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND state='pending');
DROP POLICY IF EXISTS citizen_sync_requests_cancel ON citizen_sync_requests;
CREATE POLICY citizen_sync_requests_cancel ON citizen_sync_requests FOR UPDATE
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND source_tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND state='pending')
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND source_tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid AND state='cancelled');

-- Staff can retrieve only requests explicitly addressed to their own tenant.
-- Server middleware must independently validate the authenticated staff tenant + governance token.
CREATE OR REPLACE FUNCTION citizen_staff_sync_queue(p_tenant uuid)
RETURNS TABLE(id uuid,source_tenant_id uuid,payload jsonb,provenance text,created_at timestamptz,state text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT r.id,r.source_tenant_id,r.payload,r.provenance,r.created_at,r.state
 FROM citizen_sync_requests r WHERE r.target_tenant_id=p_tenant AND r.state='pending'
 AND r.consent_confirmed_at IS NOT NULL ORDER BY r.created_at DESC LIMIT 100;
$$;
REVOKE ALL ON FUNCTION citizen_staff_sync_queue(uuid) FROM PUBLIC;
CREATE OR REPLACE FUNCTION citizen_staff_sync_decide(p_tenant uuid,p_id uuid,p_decision text,p_note text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_count int;
BEGIN
 IF p_decision NOT IN ('reviewed','rejected') OR length(p_note)<8 OR length(p_note)>500 THEN
  RAISE EXCEPTION 'Invalid sync review decision' USING ERRCODE='22023'; END IF;
 UPDATE citizen_sync_requests SET state=p_decision,reviewed_at=now(),review_note=p_note
 WHERE id=p_id AND target_tenant_id=p_tenant AND state='pending';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 RETURN v_count=1;
END $$;
REVOKE ALL ON FUNCTION citizen_staff_sync_decide(uuid,uuid,text,text) FROM PUBLIC;

CREATE TABLE IF NOT EXISTS citizen_document_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES application_documents(id) ON DELETE CASCADE,
 fields jsonb NOT NULL,
 source text NOT NULL DEFAULT 'citizen_confirmed_ocr',
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id),
 CHECK(jsonb_typeof(fields)='object')
);
ALTER TABLE citizen_document_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_document_observations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_document_observations_owner ON citizen_document_observations;
CREATE POLICY citizen_document_observations_owner ON citizen_document_observations FOR SELECT
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS citizen_document_observations_insert ON citizen_document_observations;
CREATE POLICY citizen_document_observations_insert ON citizen_document_observations FOR INSERT
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
DROP POLICY IF EXISTS citizen_document_observations_update ON citizen_document_observations;
CREATE POLICY citizen_document_observations_update ON citizen_document_observations FOR UPDATE
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

-- Only broad topic codes are recorded; no raw question or identity is stored here.
CREATE TABLE IF NOT EXISTS citizen_unanswered_topics (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 topic text NOT NULL CHECK(topic IN ('documents','fees','duration','identity','routing','eligibility','other')),
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citizen_unanswered_topics_aggregate ON citizen_unanswered_topics(tenant_id,recorded_at,topic);
CREATE OR REPLACE FUNCTION citizen_staff_unanswered_summary(p_tenant uuid)
RETURNS TABLE(topic text,question_count bigint) LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path=public,pg_temp AS $$
 SELECT u.topic,count(*) FROM citizen_unanswered_topics u
 WHERE u.tenant_id=p_tenant AND u.recorded_at>=now()-interval '90 days'
 GROUP BY u.topic HAVING count(*)>=5 ORDER BY count(*) DESC;
$$;
REVOKE ALL ON FUNCTION citizen_staff_unanswered_summary(uuid) FROM PUBLIC;

-- Statistics never reveal another citizen's individual records. Min 10 samples.
CREATE OR REPLACE FUNCTION citizen_forecast_days(p_procedure text,p_tenant uuid)
RETURNS TABLE(sample_size bigint,lower_days numeric,upper_days numeric,active_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH samples AS (
  SELECT GREATEST(0,EXTRACT(EPOCH FROM (a.updated_at-a.submitted_at))/86400) AS days
  FROM applications a WHERE a.tenant_id=p_tenant AND a.procedure_id=p_procedure
  AND a.status='completed' AND a.submitted_at IS NOT NULL
  AND a.updated_at>=a.submitted_at AND a.updated_at>now()-interval '365 days'
 ), summary AS (
  SELECT count(*) AS total,percentile_cont(0.25) WITHIN GROUP (ORDER BY days) AS p25,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY days) AS p75 FROM samples
 ) SELECT total,CASE WHEN total>=10 THEN floor(p25)::numeric ELSE NULL END,
  CASE WHEN total>=10 THEN ceil(p75)::numeric ELSE NULL END,
  (SELECT count(*) FROM applications a WHERE a.tenant_id=p_tenant AND a.procedure_id=p_procedure
   AND a.status IN ('submitted','processing','supplement'))::bigint FROM summary;
$$;
REVOKE ALL ON FUNCTION citizen_forecast_days(text,uuid) FROM PUBLIC;

DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
 GRANT SELECT,INSERT,UPDATE(revoked_at) ON citizen_result_verifications TO communeos_app;
 GRANT SELECT,INSERT,UPDATE(state) ON citizen_sync_requests TO communeos_app;
 GRANT SELECT,INSERT,UPDATE(fields,confirmed_at) ON citizen_document_observations TO communeos_app;
 GRANT INSERT ON citizen_unanswered_topics TO communeos_app;
 GRANT EXECUTE ON FUNCTION citizen_verify_result_public(text),citizen_staff_sync_queue(uuid),
  citizen_staff_sync_decide(uuid,uuid,text,text),citizen_staff_unanswered_summary(uuid),
  citizen_forecast_days(text,uuid) TO communeos_app;
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO communeos_app;
END IF; END $$;
