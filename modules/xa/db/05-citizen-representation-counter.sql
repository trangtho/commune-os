-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- The citizen may REQUEST representation, never approve their own authority.
CREATE TABLE IF NOT EXISTS citizen_representations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id uuid NOT NULL REFERENCES citizens(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  represented_name text NOT NULL CHECK (char_length(btrim(represented_name)) BETWEEN 2 AND 120),
  relationship text NOT NULL CHECK (relationship IN ('parent','child','spouse','guardian','other')),
  legal_basis text NOT NULL CHECK (legal_basis IN ('authorization','legal_representative')),
  authorization_reference text NOT NULL DEFAULT '',
  procedure_id text NOT NULL REFERENCES procedures(id),
  valid_until date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','revoked')),
  verified_by text,
  verified_at timestamptz,
  evidence_key text UNIQUE,
  evidence_name text,
  evidence_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL AND evidence_key IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS citizen_representations_owner_idx
  ON citizen_representations (citizen_id, tenant_id, updated_at DESC);
ALTER TABLE citizen_representations ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_representations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_representations_read ON citizen_representations;
CREATE POLICY citizen_representations_read ON citizen_representations FOR SELECT
  USING (citizen_id = nullif(current_setting('app.citizen_id', true), '')::uuid
     AND tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS citizen_representations_create ON citizen_representations;
CREATE POLICY citizen_representations_create ON citizen_representations FOR INSERT
  WITH CHECK (citizen_id = nullif(current_setting('app.citizen_id', true), '')::uuid
     AND tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
     AND status = 'pending' AND verified_at IS NULL AND verified_by IS NULL);
DROP POLICY IF EXISTS citizen_representations_evidence ON citizen_representations;
CREATE POLICY citizen_representations_evidence ON citizen_representations FOR UPDATE
  USING (citizen_id = nullif(current_setting('app.citizen_id', true), '')::uuid
     AND tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
     AND status IN ('pending','verified'))
  WITH CHECK (citizen_id = nullif(current_setting('app.citizen_id', true), '')::uuid
     AND tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
     AND status IN ('pending','verified'));

-- The app has column-limited UPDATE privileges, but may not swap evidence after approval.
CREATE OR REPLACE FUNCTION prevent_verified_evidence_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Evidence cannot be altered after review';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS citizen_representation_protect_evidence ON citizen_representations;
CREATE TRIGGER citizen_representation_protect_evidence BEFORE UPDATE OF evidence_key,evidence_name,evidence_type
  ON citizen_representations FOR EACH ROW EXECUTE FUNCTION prevent_verified_evidence_change();

-- A separate audit trail is append-only for the application role.
CREATE TABLE IF NOT EXISTS citizen_representation_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  representation_id uuid NOT NULL REFERENCES citizen_representations(id),
  citizen_id uuid NOT NULL REFERENCES citizens(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  action text NOT NULL CHECK (action IN ('requested','evidence_uploaded','verified','rejected','revoked','application_created','application_submitted')),
  application_id text,
  actor_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citizen_representation_audit_owner_idx
  ON citizen_representation_audit (citizen_id, tenant_id, created_at DESC);
ALTER TABLE citizen_representation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_representation_audit FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_representation_audit_read ON citizen_representation_audit;
CREATE POLICY citizen_representation_audit_read ON citizen_representation_audit FOR SELECT
  USING (citizen_id = nullif(current_setting('app.citizen_id', true), '')::uuid
     AND tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS citizen_representation_audit_write ON citizen_representation_audit;
CREATE POLICY citizen_representation_audit_write ON citizen_representation_audit FOR INSERT
  WITH CHECK (citizen_id = nullif(current_setting('app.citizen_id', true), '')::uuid
     AND tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
     AND EXISTS (SELECT 1 FROM citizen_representations r WHERE r.id = representation_id AND r.citizen_id = citizen_id));

-- Only DB owner / a separately authenticated reviewing service may set verified status.
-- A citizen can revoke, but cannot approve or extend authority.
CREATE OR REPLACE FUNCTION citizen_revoke_own_representation(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := nullif(current_setting('app.citizen_id', true), '')::uuid;
DECLARE v_tenant uuid := nullif(current_setting('app.tenant_id', true), '')::uuid;
BEGIN
  IF v_actor IS NULL OR v_tenant IS NULL THEN RETURN false; END IF;
  UPDATE citizen_representations SET status = 'revoked', updated_at = now()
  WHERE id = p_id AND citizen_id = v_actor AND tenant_id = v_tenant
    AND status IN ('pending','verified','rejected');
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION citizen_revoke_own_representation(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION audit_representation_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO citizen_representation_audit (representation_id, citizen_id, tenant_id, action, actor_name)
    VALUES (NEW.id, NEW.citizen_id, NEW.tenant_id,
      CASE WHEN NEW.status = 'verified' THEN 'verified'
           WHEN NEW.status = 'rejected' THEN 'rejected' ELSE 'revoked' END,
      CASE WHEN NEW.status='revoked' THEN 'Công dân yêu cầu thu hồi' ELSE coalesce(NEW.verified_by, 'Hệ thống') END);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS citizen_representation_status_audit ON citizen_representations;
CREATE TRIGGER citizen_representation_status_audit AFTER UPDATE OF status ON citizen_representations
  FOR EACH ROW EXECUTE FUNCTION audit_representation_status();

ALTER TABLE applications ADD COLUMN IF NOT EXISTS representation_id uuid REFERENCES citizen_representations(id);
CREATE INDEX IF NOT EXISTS applications_representation_idx ON applications (representation_id) WHERE representation_id IS NOT NULL;

-- Counter tickets store only a procedure and an expiry, NEVER identity or form data.
CREATE TABLE IF NOT EXISTS citizen_counter_sessions (
  code_hash text PRIMARY KEY CHECK (length(code_hash) = 64),
  procedure_id text NOT NULL REFERENCES procedures(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS citizen_counter_sessions_expiry_idx ON citizen_counter_sessions(expires_at);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'communeos_app') THEN
    GRANT SELECT, INSERT ON citizen_representations TO communeos_app;
    GRANT UPDATE (evidence_key, evidence_name, evidence_type, updated_at) ON citizen_representations TO communeos_app;
    GRANT SELECT, INSERT ON citizen_representation_audit TO communeos_app;
    GRANT USAGE, SELECT ON SEQUENCE citizen_representation_audit_id_seq TO communeos_app;
    GRANT EXECUTE ON FUNCTION citizen_revoke_own_representation(uuid) TO communeos_app;
    GRANT INSERT (representation_id) ON applications TO communeos_app;
    GRANT UPDATE (representation_id) ON applications TO communeos_app;
    GRANT SELECT, INSERT ON citizen_counter_sessions TO communeos_app;
    GRANT UPDATE (ended_at) ON citizen_counter_sessions TO communeos_app;
  END IF;
END $$;
