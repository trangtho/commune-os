-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Test authorization gates and tenant isolation; rollback every mutation.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF has_column_privilege('communeos_app','citizen_representations','status','UPDATE') THEN
    RAISE EXCEPTION 'The app role must never be allowed to approve its own representation';
  END IF;
  IF has_table_privilege('communeos_app','citizen_representations','DELETE') THEN
    RAISE EXCEPTION 'The app role must not delete representation history';
  END IF;
END $$;
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
INSERT INTO citizen_representations(citizen_id,tenant_id,represented_name,relationship,legal_basis,
  procedure_id,valid_until,authorization_reference)
VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
  'Người thân thử nghiệm','child','authorization','khai-sinh',CURRENT_DATE+30,'TEST') ;
DO $$ DECLARE total integer;BEGIN
  SELECT count(*) INTO total FROM citizen_representations WHERE represented_name='Người thân thử nghiệm';
  IF total<>1 THEN RAISE EXCEPTION 'Owner should read own pending representation';END IF;
END $$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE total integer;BEGIN
  SELECT count(*) INTO total FROM citizen_representations WHERE represented_name='Người thân thử nghiệm';
  IF total<>0 THEN RAISE EXCEPTION 'Cross-tenant representation leak';END IF;
END $$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE v_id uuid;BEGIN
  SELECT id INTO v_id FROM citizen_representations WHERE represented_name='Người thân thử nghiệm';
  IF NOT citizen_revoke_own_representation(v_id) THEN RAISE EXCEPTION 'Owner revoke failed';END IF;
  IF EXISTS(SELECT 1 FROM citizen_representations WHERE id=v_id AND status <> 'revoked') THEN
    RAISE EXCEPTION 'Revoke did not change status';END IF;
  IF NOT EXISTS(SELECT 1 FROM citizen_representation_audit WHERE representation_id=v_id AND action='revoked') THEN
    RAISE EXCEPTION 'Audit trigger did not record revocation';END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM citizen_counter_sessions WHERE expires_at <= created_at) THEN
    RAISE EXCEPTION 'Invalid counter session expiry';END IF;
END $$;
ROLLBACK;
SELECT 'Citizen representation and counter tests passed (all changes rolled back)' AS result;
