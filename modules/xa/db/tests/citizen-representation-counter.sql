-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
-- Test authorization gates and tenant isolation; rollback every mutation.
-- Xã và công dân mẫu do make demo tạo (mã ngẫu nhiên theo từng bản cài): xa-a, xa-b, congdan.demo, congdan.khac.
DO $demo$ BEGIN
  IF (SELECT count(*) FROM tenants WHERE code IN ('xa-a','xa-b')) < 2
     OR (SELECT count(*) FROM citizens WHERE login_name IN ('congdan.demo','congdan.khac')) < 2 THEN
    RAISE EXCEPTION 'Chưa có dữ liệu mẫu: chạy make demo trước khi kiểm thử';
  END IF;
  PERFORM set_config('demo.tenant_a', (SELECT id::text FROM tenants WHERE code = 'xa-a'), false),
          set_config('demo.tenant_b', (SELECT id::text FROM tenants WHERE code = 'xa-b'), false),
          set_config('demo.citizen_a', (SELECT id::text FROM citizens WHERE login_name = 'congdan.demo'), false),
          set_config('demo.citizen_b', (SELECT id::text FROM citizens WHERE login_name = 'congdan.khac'), false);
END $demo$;
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF has_column_privilege('citizen-app','citizen_representations','status','UPDATE') THEN
    RAISE EXCEPTION 'The app role must never be allowed to approve its own representation';
  END IF;
  IF has_table_privilege('citizen-app','citizen_representations','DELETE') THEN
    RAISE EXCEPTION 'The app role must not delete representation history';
  END IF;
END $$;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
INSERT INTO citizen_representations(citizen_id,tenant_id,represented_name,relationship,legal_basis,
  procedure_id,valid_until,authorization_reference)
VALUES(current_setting('demo.citizen_a')::uuid,current_setting('demo.tenant_a')::uuid,
  'Người thân thử nghiệm','child','authorization','khai-sinh',CURRENT_DATE+30,'TEST') ;
DO $$ DECLARE total integer;BEGIN
  SELECT count(*) INTO total FROM citizen_representations WHERE represented_name='Người thân thử nghiệm';
  IF total<>1 THEN RAISE EXCEPTION 'Owner should read own pending representation';END IF;
END $$;
SELECT set_config('app.citizen_id',current_setting('demo.citizen_b'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_b'),true);
DO $$ DECLARE total integer;BEGIN
  SELECT count(*) INTO total FROM citizen_representations WHERE represented_name='Người thân thử nghiệm';
  IF total<>0 THEN RAISE EXCEPTION 'Cross-tenant representation leak';END IF;
END $$;
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
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
