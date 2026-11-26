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
DO $$ BEGIN
 IF has_table_privilege('citizen-app','citizen_case_handoffs','DELETE') THEN
  RAISE EXCEPTION 'Citizen application must not delete handoff records'; END IF;
 IF has_column_privilege('citizen-app','citizen_case_handoffs','redeemed_at','UPDATE') THEN
  RAISE EXCEPTION 'Citizen must not claim handoffs on behalf of staff'; END IF;
 IF has_column_privilege('citizen-app','citizen_support_tickets','status','UPDATE') THEN
  RAISE EXCEPTION 'Citizen must not directly assign staff status'; END IF;
END $$;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name)
VALUES('__CITIZEN_HANDOFF_SELFTEST__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'khai-sinh','draft','Công dân thử nghiệm');
INSERT INTO citizen_case_handoffs(application_id,citizen_id,tenant_id,code_hash,expires_at)
VALUES('__CITIZEN_HANDOFF_SELFTEST__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,repeat('a',64),now()+interval '5 minutes');
INSERT INTO citizen_support_tickets(id,citizen_id,tenant_id,category,subject)
VALUES('30000000-0000-4000-8000-000000000001',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'phan-anh','Đề nghị kiểm tra tiến độ');
INSERT INTO citizen_support_ticket_events(ticket_id,actor_type,actor_name,event_type,message)
VALUES('30000000-0000-4000-8000-000000000001','citizen','Công dân','message','Tôi muốn biết tiến độ xử lý.');
DO $$BEGIN
 IF (SELECT count(*) FROM citizen_case_handoffs WHERE application_id='__CITIZEN_HANDOFF_SELFTEST__')<>1
  THEN RAISE EXCEPTION 'Owner handoff not visible';END IF;
 IF (SELECT count(*) FROM citizen_support_tickets WHERE subject='Đề nghị kiểm tra tiến độ')<>1
  THEN RAISE EXCEPTION 'Owner ticket not visible';END IF;
END $$;
SELECT set_config('app.citizen_id',current_setting('demo.citizen_b'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_b'),true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM citizen_case_handoffs WHERE application_id='__CITIZEN_HANDOFF_SELFTEST__')
 OR EXISTS(SELECT 1 FROM citizen_support_tickets WHERE id='30000000-0000-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM citizen_support_ticket_events WHERE ticket_id='30000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Cross-tenant handoff or support record disclosed'; END IF;
 IF citizen_reply_support_ticket('30000000-0000-4000-8000-000000000001','Unauthorized response','Công dân khác') IS NOT NULL
 THEN RAISE EXCEPTION 'Cross-tenant reply succeeded'; END IF;
END $$;
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM citizen_case_handoffs WHERE application_id='__CITIZEN_HANDOFF_SELFTEST__')
 OR EXISTS(SELECT 1 FROM citizen_support_tickets WHERE id='30000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Cross-account same-tenant data disclosed'; END IF;
END $$;
RESET ROLE;
DO $$DECLARE v_claim jsonb;BEGIN
 IF citizen_staff_redeem_handoff(repeat('a',64),current_setting('demo.tenant_b')::uuid,'staff-test') IS NOT NULL
 THEN RAISE EXCEPTION 'Wrong tenant redeemed handoff'; END IF;
 v_claim:=citizen_staff_redeem_handoff(repeat('a',64),current_setting('demo.tenant_a')::uuid,'staff-test');
 IF v_claim IS NULL OR v_claim->'application'->>'id'<>'__CITIZEN_HANDOFF_SELFTEST__'
 THEN RAISE EXCEPTION 'Authorized staff could not redeem'; END IF;
 IF citizen_staff_redeem_handoff(repeat('a',64),current_setting('demo.tenant_a')::uuid,'staff-test') IS NOT NULL
 THEN RAISE EXCEPTION 'Handoff replay was accepted'; END IF;
 IF citizen_staff_update_support_ticket('30000000-0000-4000-8000-000000000001',
     current_setting('demo.tenant_b')::uuid,'staff-test','answered','Hello','')
 THEN RAISE EXCEPTION 'Wrong tenant updated ticket'; END IF;
 IF NOT citizen_staff_update_support_ticket('30000000-0000-4000-8000-000000000001',
     current_setting('demo.tenant_a')::uuid,'staff-test','answered','Vui lòng bổ sung thông tin','')
 THEN RAISE EXCEPTION 'Authorized staff could not reply'; END IF;
 IF citizen_staff_support_ticket_detail('30000000-0000-4000-8000-000000000001',
     current_setting('demo.tenant_b')::uuid) IS NOT NULL
 THEN RAISE EXCEPTION 'Cross-tenant staff ticket detail leaked'; END IF;
END $$;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
DO $$DECLARE v_result text;BEGIN
 v_result:=citizen_reply_support_ticket('30000000-0000-4000-8000-000000000001',
 'Tôi cần tiếp tục làm rõ câu trả lời này.','Công dân');
 IF v_result<>'reopened' THEN RAISE EXCEPTION 'Reply status changed unexpectedly';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Citizen handoff and support isolation tests passed (all changes rolled back)' AS result;
