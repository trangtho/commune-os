-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Citizen-controlled personalization preferences. Self-declared locality is NOT verified identity data.
CREATE TABLE IF NOT EXISTS citizen_service_preferences (
  citizen_id uuid PRIMARY KEY REFERENCES citizens(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  personalization_enabled boolean NOT NULL DEFAULT false,
  audience_group text NOT NULL DEFAULT 'general'
    CHECK (audience_group IN ('general', 'parent', 'business', 'resident', 'other')),
  interest_categories text[] NOT NULL DEFAULT '{}'::text[],
  residence_tenant_id uuid REFERENCES tenants(id),
  temporary_tenant_id uuid REFERENCES tenants(id),
  preferred_tenant_id uuid REFERENCES tenants(id),
  locality_source text NOT NULL DEFAULT 'self_declared'
    CHECK (locality_source IN ('self_declared', 'oidc_verified')),
  locality_verified_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (citizen_id, tenant_id),
  CHECK (cardinality(interest_categories) <= 8)
);
CREATE INDEX IF NOT EXISTS citizen_service_preferences_tenant_idx
  ON citizen_service_preferences (tenant_id, citizen_id);
ALTER TABLE citizen_service_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_service_preferences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_service_preferences_owner ON citizen_service_preferences;
CREATE POLICY citizen_service_preferences_owner ON citizen_service_preferences FOR ALL
 USING (citizen_id = nullif(current_setting('app.citizen_id', true), '')::uuid
    AND tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
 WITH CHECK (citizen_id = nullif(current_setting('app.citizen_id', true), '')::uuid
    AND tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

-- Metadata must be verified by an authorized catalog maintainer before ranking by audience.
-- No legal eligibility can be inferred from the procedure title alone.
CREATE TABLE IF NOT EXISTS procedure_recommendation_metadata (
  procedure_id text PRIMARY KEY REFERENCES procedures(id) ON DELETE CASCADE,
  audience_groups text[] NOT NULL DEFAULT '{}'::text[],
  verified_at timestamptz,
  source_reference text,
  available_tenant_ids uuid[] NOT NULL DEFAULT '{}'::uuid[]
);

-- Explicit cross-locality permission is opt-in and time-limited. No routes are seeded.
-- The citizen-facing app never grants or changes these permissions.
CREATE TABLE IF NOT EXISTS citizen_procedure_receivers (
  procedure_id text NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  source_tenant_id uuid NOT NULL REFERENCES tenants(id),
  receiving_tenant_id uuid NOT NULL REFERENCES tenants(id),
  enabled boolean NOT NULL DEFAULT false,
  approval_reference text NOT NULL DEFAULT '',
  valid_until timestamptz,
  PRIMARY KEY (procedure_id, source_tenant_id, receiving_tenant_id),
  CHECK (source_tenant_id <> receiving_tenant_id)
);

-- Preserve ownership tenant for RLS; receiving locality is independent workflow metadata.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS receiving_tenant_id uuid REFERENCES tenants(id);
UPDATE applications SET receiving_tenant_id = tenant_id WHERE receiving_tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS applications_receiving_tenant_idx
  ON applications (receiving_tenant_id, updated_at DESC);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'communeos_app') THEN
    GRANT SELECT, INSERT, DELETE ON citizen_service_preferences TO communeos_app;
    GRANT UPDATE (personalization_enabled, audience_group, interest_categories,
      residence_tenant_id, temporary_tenant_id, preferred_tenant_id,
      locality_source, locality_verified_at, updated_at)
      ON citizen_service_preferences TO communeos_app;
    GRANT SELECT ON procedure_recommendation_metadata, citizen_procedure_receivers TO communeos_app;
    GRANT INSERT (receiving_tenant_id) ON applications TO communeos_app;
    GRANT UPDATE (receiving_tenant_id) ON applications TO communeos_app;
  END IF;
END $$;
