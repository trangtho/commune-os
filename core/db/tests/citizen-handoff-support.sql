-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF has_table_privilege('communeos_app','citizen_case_handoffs','DELETE') THEN
  RAISE EXCEPTION 'Citizen application must not delete handoff records'; END IF;
 IF has_column_privilege('communeos_app','citizen_case_handoffs','redeemed_at','UPDATE') THEN
  RAISE EXCEPTION 'Citizen must not claim handoffs on behalf of staff'; END IF;
 IF has_column_privilege('communeos_app','citizen_support_tickets','status','UPDATE') THEN
  RAISE EXCEPTION 'Citizen must not directly assign staff status'; END IF;
END $$;
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name)
VALUES('__CITIZEN_HANDOFF_SELFTEST__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','khai-sinh','draft','Công dân thử nghiệm');
INSERT INTO citizen_case_handoffs(application_id,citizen_id,tenant_id,code_hash,expires_at)
VALUES('__CITIZEN_HANDOFF_SELFTEST__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001',repeat('a',64),now()+interval '5 minutes');
INSERT INTO citizen_support_tickets(id,citizen_id,tenant_id,category,subject)
VALUES('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','phan-anh','Đề nghị kiểm tra tiến độ');
INSERT INTO citizen_support_ticket_events(ticket_id,actor_type,actor_name,event_type,message)
VALUES('30000000-0000-4000-8000-000000000001','citizen','Công dân','message','Tôi muốn biết tiến độ xử lý.');
DO $$BEGIN
 IF (SELECT count(*) FROM citizen_case_handoffs WHERE application_id='__CITIZEN_HANDOFF_SELFTEST__')<>1
  THEN RAISE EXCEPTION 'Owner handoff not visible';END IF;
 IF (SELECT count(*) FROM citizen_support_tickets WHERE subject='Đề nghị kiểm tra tiến độ')<>1
  THEN RAISE EXCEPTION 'Owner ticket not visible';END IF;
END $$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM citizen_case_handoffs WHERE application_id='__CITIZEN_HANDOFF_SELFTEST__')
 OR EXISTS(SELECT 1 FROM citizen_support_tickets WHERE id='30000000-0000-4000-8000-000000000001')
 OR EXISTS(SELECT 1 FROM citizen_support_ticket_events WHERE ticket_id='30000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Cross-tenant handoff or support record disclosed'; END IF;
 IF citizen_reply_support_ticket('30000000-0000-4000-8000-000000000001','Unauthorized response','Công dân khác') IS NOT NULL
 THEN RAISE EXCEPTION 'Cross-tenant reply succeeded'; END IF;
END $$;
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM citizen_case_handoffs WHERE application_id='__CITIZEN_HANDOFF_SELFTEST__')
 OR EXISTS(SELECT 1 FROM citizen_support_tickets WHERE id='30000000-0000-4000-8000-000000000001')
 THEN RAISE EXCEPTION 'Cross-account same-tenant data disclosed'; END IF;
END $$;
RESET ROLE;
DO $$DECLARE v_claim jsonb;BEGIN
 IF citizen_staff_redeem_handoff(repeat('a',64),'10000000-0000-4000-8000-000000000002','staff-test') IS NOT NULL
 THEN RAISE EXCEPTION 'Wrong tenant redeemed handoff'; END IF;
 v_claim:=citizen_staff_redeem_handoff(repeat('a',64),'10000000-0000-4000-8000-000000000001','staff-test');
 IF v_claim IS NULL OR v_claim->'application'->>'id'<>'__CITIZEN_HANDOFF_SELFTEST__'
 THEN RAISE EXCEPTION 'Authorized staff could not redeem'; END IF;
 IF citizen_staff_redeem_handoff(repeat('a',64),'10000000-0000-4000-8000-000000000001','staff-test') IS NOT NULL
 THEN RAISE EXCEPTION 'Handoff replay was accepted'; END IF;
 IF citizen_staff_update_support_ticket('30000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000002','staff-test','answered','Hello','')
 THEN RAISE EXCEPTION 'Wrong tenant updated ticket'; END IF;
 IF NOT citizen_staff_update_support_ticket('30000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000001','staff-test','answered','Vui lòng bổ sung thông tin','')
 THEN RAISE EXCEPTION 'Authorized staff could not reply'; END IF;
 IF citizen_staff_support_ticket_detail('30000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000002') IS NOT NULL
 THEN RAISE EXCEPTION 'Cross-tenant staff ticket detail leaked'; END IF;
END $$;
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $$DECLARE v_result text;BEGIN
 v_result:=citizen_reply_support_ticket('30000000-0000-4000-8000-000000000001',
 'Tôi cần tiếp tục làm rõ câu trả lời này.','Công dân');
 IF v_result<>'reopened' THEN RAISE EXCEPTION 'Reply status changed unexpectedly';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Citizen handoff and support isolation tests passed (all changes rolled back)' AS result;
