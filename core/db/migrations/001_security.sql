-- SPDX-License-Identifier: Apache-2.0
-- Enforced on the same table-owner DB role used by the application.
-- No business request uses a DB superuser. Context is set only from validated JWT.
CREATE OR REPLACE FUNCTION commune_tenant_ok(tid varchar, owner_id varchar DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT current_setting('app.role', true) = 'sys_admin'
 OR (tid = current_setting('app.tenant_id', true)
     AND current_setting('app.role', true) NOT IN ('supervisor','')
     AND (current_setting('app.role', true) <> 'citizen'
          OR owner_id = current_setting('app.user_id', true)))
$$;
-- STATEMENT --
DO $$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['dossiers','documents','dossier_events','ledger','appointments','queue_tickets','feedback'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
 END LOOP;
END $$;
-- STATEMENT --
DROP POLICY IF EXISTS dossiers_scope ON dossiers;
-- STATEMENT --
CREATE POLICY dossiers_scope ON dossiers FOR ALL
 USING (commune_tenant_ok(tenant_id, submitted_by))
 WITH CHECK (commune_tenant_ok(tenant_id, submitted_by));
-- STATEMENT --
DROP POLICY IF EXISTS documents_scope ON documents;
-- STATEMENT --
CREATE POLICY documents_scope ON documents FOR ALL
 USING (commune_tenant_ok(tenant_id) AND (current_setting('app.role', true) <> 'citizen' OR EXISTS
     (SELECT 1 FROM dossiers WHERE dossiers.id = documents.dossier_id AND dossiers.submitted_by = current_setting('app.user_id', true))))
 WITH CHECK (commune_tenant_ok(tenant_id) AND (current_setting('app.role', true) <> 'citizen' OR EXISTS
     (SELECT 1 FROM dossiers WHERE dossiers.id = documents.dossier_id AND dossiers.submitted_by = current_setting('app.user_id', true))));
-- STATEMENT --
DROP POLICY IF EXISTS events_scope ON dossier_events;
-- STATEMENT --
CREATE POLICY events_scope ON dossier_events FOR ALL
 USING (commune_tenant_ok(tenant_id) AND (current_setting('app.role', true) <> 'citizen' OR EXISTS
     (SELECT 1 FROM dossiers WHERE dossiers.id = dossier_events.dossier_id AND dossiers.submitted_by = current_setting('app.user_id', true))))
 WITH CHECK (commune_tenant_ok(tenant_id) AND (current_setting('app.role', true) <> 'citizen' OR EXISTS
     (SELECT 1 FROM dossiers WHERE dossiers.id = dossier_events.dossier_id AND dossiers.submitted_by = current_setting('app.user_id', true))));
-- STATEMENT --
DROP POLICY IF EXISTS ledger_scope ON ledger;
-- STATEMENT --
CREATE POLICY ledger_scope ON ledger FOR ALL
 USING (commune_tenant_ok(tenant_id) AND current_setting('app.role', true) <> 'citizen')
 WITH CHECK (commune_tenant_ok(tenant_id) AND current_setting('app.role', true) <> 'citizen');
-- STATEMENT --
DROP POLICY IF EXISTS appointments_scope ON appointments;
-- STATEMENT --
CREATE POLICY appointments_scope ON appointments FOR ALL
 USING (commune_tenant_ok(tenant_id, user_id)) WITH CHECK (commune_tenant_ok(tenant_id, user_id));
-- STATEMENT --
DROP POLICY IF EXISTS queue_scope ON queue_tickets;
-- STATEMENT --
CREATE POLICY queue_scope ON queue_tickets FOR ALL
 USING (commune_tenant_ok(tenant_id, user_id)) WITH CHECK (commune_tenant_ok(tenant_id, user_id));
-- STATEMENT --
DROP POLICY IF EXISTS feedback_scope ON feedback;
-- STATEMENT --
CREATE POLICY feedback_scope ON feedback FOR ALL
 USING (commune_tenant_ok(tenant_id, user_id)) WITH CHECK (commune_tenant_ok(tenant_id, user_id));
-- STATEMENT --
ALTER TABLE tenant_metrics ENABLE ROW LEVEL SECURITY;
-- STATEMENT --
ALTER TABLE tenant_metrics FORCE ROW LEVEL SECURITY;
-- STATEMENT --
DROP POLICY IF EXISTS metrics_select ON tenant_metrics;
-- STATEMENT --
CREATE POLICY metrics_select ON tenant_metrics FOR SELECT
 USING (current_setting('app.role',true) IN ('supervisor','sys_admin') OR tenant_id = current_setting('app.tenant_id',true));
-- STATEMENT --
DROP POLICY IF EXISTS metrics_write ON tenant_metrics;
-- STATEMENT --
CREATE POLICY metrics_write ON tenant_metrics FOR ALL
 USING (current_setting('app.role',true) = 'sys_admin' OR (tenant_id=current_setting('app.tenant_id',true) AND current_setting('app.role',true) <> 'supervisor'))
 WITH CHECK (current_setting('app.role',true) = 'sys_admin' OR (tenant_id=current_setting('app.tenant_id',true) AND current_setting('app.role',true) <> 'supervisor'));
-- STATEMENT --
CREATE OR REPLACE FUNCTION commune_no_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Append-only audit data cannot be updated or deleted'; END; $$;
-- STATEMENT --
DROP TRIGGER IF EXISTS ledger_immutable ON ledger;
-- STATEMENT --
CREATE TRIGGER ledger_immutable BEFORE UPDATE OR DELETE ON ledger FOR EACH ROW EXECUTE FUNCTION commune_no_rewrite();
-- STATEMENT --
DROP TRIGGER IF EXISTS events_immutable ON dossier_events;
-- STATEMENT --
CREATE TRIGGER events_immutable BEFORE UPDATE OR DELETE ON dossier_events FOR EACH ROW EXECUTE FUNCTION commune_no_rewrite();
