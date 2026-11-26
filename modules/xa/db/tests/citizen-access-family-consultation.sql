-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
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
DO $$BEGIN
  IF has_table_privilege('citizen-app','citizen_consultation_slots','INSERT') THEN
    RAISE EXCEPTION 'Citizen role may not publish staff consultation slots'; END IF;
  IF has_column_privilege('citizen-app','citizen_consultation_requests','status','UPDATE') THEN
    RAISE EXCEPTION 'Citizen role may not self-confirm consultation'; END IF;
  IF has_table_privilege('citizen-app','citizen_stage_reviews','DELETE') THEN
    RAISE EXCEPTION 'Citizen role must not delete submitted ratings'; END IF;
END $$;
-- Owner provisions a temporary published slot, rolled back with this transaction.
INSERT INTO citizen_consultation_slots(tenant_id,category,starts_at,ends_at,capacity,is_published)
VALUES(current_setting('demo.tenant_a')::uuid,'__citizen_experience_test__',now()+interval '3 days',now()+interval '3 days 30 minutes',1,true);
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
INSERT INTO citizen_consultation_requests(citizen_id,tenant_id,category,subject,description,channel,contact_phone,preferred_at,slot_id)
SELECT current_setting('demo.citizen_a')::uuid,current_setting('demo.tenant_a')::uuid,'__citizen_experience_test__',
  '__communeos_selftest_consult__','Tôi cần hỏi về các giấy tờ phải nộp trước khi đăng ký khai sinh',
  'phone','0912345678',starts_at,id
FROM citizen_consultation_slots WHERE category='__citizen_experience_test__' AND starts_at>now() ORDER BY starts_at DESC LIMIT 1;
DO $$DECLARE v_id uuid; v_slot uuid;BEGIN
  SELECT id,slot_id INTO v_id,v_slot FROM citizen_consultation_requests
    WHERE subject='__communeos_selftest_consult__' ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL OR v_slot IS NULL THEN RAISE EXCEPTION 'Cannot create consultation';END IF;
  IF citizen_slot_remaining(v_slot) <> 0 THEN RAISE EXCEPTION 'Capacity not enforced';END IF;
  IF NOT citizen_cancel_consultation(v_id) THEN RAISE EXCEPTION 'Cannot cancel own request';END IF;
  IF citizen_slot_remaining(v_slot) <> 1 THEN RAISE EXCEPTION 'Cancel did not release capacity';END IF;
END $$;
-- Reviews are scoped to the applicant owner, even when a family relationship exists.
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name)
VALUES('__COMMUNEOS_STAGE_SELFTEST__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'khai-sinh','draft','Công dân kiểm thử');
INSERT INTO citizen_stage_reviews(application_id,citizen_id,tenant_id,stage,rating,comment)
VALUES('__COMMUNEOS_STAGE_SELFTEST__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'guidance',4,'Kiểm thử đánh giá');
DO $$DECLARE v_count integer;BEGIN
 SELECT count(*) INTO v_count FROM citizen_stage_reviews WHERE application_id='__COMMUNEOS_STAGE_SELFTEST__';
 IF v_count<>1 THEN RAISE EXCEPTION 'Owner review not visible';END IF;
END $$;
SELECT set_config('app.citizen_id',current_setting('demo.citizen_b'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_b'),true);
DO $$DECLARE v_count integer;BEGIN
 SELECT count(*) INTO v_count FROM citizen_consultation_requests WHERE subject='__communeos_selftest_consult__';
 IF v_count<>0 THEN RAISE EXCEPTION 'Cross-tenant consultation disclosed';END IF;
 SELECT count(*) INTO v_count FROM citizen_stage_reviews WHERE application_id='__COMMUNEOS_STAGE_SELFTEST__';
 IF v_count<>0 THEN RAISE EXCEPTION 'Cross-tenant review disclosed';END IF;
 SELECT count(*) INTO v_count FROM citizen_consultation_slots WHERE category='__citizen_experience_test__';
 IF v_count<>0 THEN RAISE EXCEPTION 'Cross-tenant staff slots disclosed';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Citizen accessibility, family, consultation and reviews SQL checks passed (rolled back)' AS result;
