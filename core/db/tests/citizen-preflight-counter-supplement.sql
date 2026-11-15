-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Tenant isolation, atomic queue, supplement field response; all changes rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF has_table_privilege('communeos_app','citizen_counter_slots','INSERT') THEN
  RAISE EXCEPTION 'Citizen must not publish its own counter slots'; END IF;
 IF has_table_privilege('communeos_app','citizen_supplement_items','UPDATE') THEN
  RAISE EXCEPTION 'Citizen must not edit staff supplement requests'; END IF;
 IF has_function_privilege('communeos_app','api.publish_counter_slot(text,timestamptz,timestamptz,integer)','EXECUTE') THEN
  RAISE EXCEPTION 'Citizen may not invoke staff slot publishing RPC'; END IF;
END $$;
INSERT INTO citizen_counter_slots(id,tenant_id,procedure_id,starts_at,ends_at,capacity,published)
VALUES('eeeeeeee-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 'khai-sinh',now()+interval '3 days',now()+interval '3 days 30 minutes',1,true);
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,form_data)
VALUES('__SELFTEST_SUPPLEMENT_ITEM__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','khai-sinh','supplement','Người kiểm thử',
 '{"childName":"Bé kiểm thử"}'::jsonb);
INSERT INTO application_events(application_id,event_type,note,actor_name)
VALUES('__SELFTEST_SUPPLEMENT_ITEM__','supplement','Thiếu thông tin','Cán bộ kiểm thử');
INSERT INTO citizen_supplement_items(id,application_id,request_event_id,kind,target_key,instruction,reason)
VALUES('eeeeeeee-0000-4000-8000-000000000002','__SELFTEST_SUPPLEMENT_ITEM__',
 (SELECT max(id) FROM application_events WHERE application_id='__SELFTEST_SUPPLEMENT_ITEM__'),
 'field','childName','Giải trình tên của trẻ','Thông tin chưa được xác nhận');
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE b jsonb; v_count integer; v_booking_id uuid;BEGIN
 b:=citizen_book_counter_slot('eeeeeeee-0000-4000-8000-000000000001');
 IF (b->>'ticket_number')::integer<>1 THEN RAISE EXCEPTION 'Ticket number incorrect';END IF;
 BEGIN
  PERFORM citizen_book_counter_slot('eeeeeeee-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'Duplicate active booking was not blocked';
 EXCEPTION WHEN sqlstate '22023' THEN NULL; END;
 SELECT id INTO v_booking_id FROM citizen_counter_bookings WHERE slot_id='eeeeeeee-0000-4000-8000-000000000001';
 IF NOT citizen_cancel_counter_booking(v_booking_id) THEN RAISE EXCEPTION 'Owner could not cancel booking'; END IF;
 b:=citizen_book_counter_slot('eeeeeeee-0000-4000-8000-000000000001');
 IF (b->>'ticket_number')::integer<>2 THEN RAISE EXCEPTION 'Ticket number was reused after cancellation';END IF;
 IF NOT citizen_answer_supplement_item('eeeeeeee-0000-4000-8000-000000000002','Tên trẻ đã xác nhận',NULL) THEN
  RAISE EXCEPTION 'Owner cannot answer own supplement item'; END IF;
 SELECT count(*) INTO v_count FROM citizen_supplement_items WHERE application_id='__SELFTEST_SUPPLEMENT_ITEM__';
 IF v_count<>1 THEN RAISE EXCEPTION 'Owner supplement request not visible'; END IF;
END $$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE n integer;BEGIN
 SELECT count(*) INTO n FROM citizen_counter_slots WHERE id='eeeeeeee-0000-4000-8000-000000000001';
 IF n<>0 THEN RAISE EXCEPTION 'Cross-tenant slot leaked';END IF;
 SELECT count(*) INTO n FROM citizen_counter_bookings WHERE slot_id='eeeeeeee-0000-4000-8000-000000000001';
 IF n<>0 THEN RAISE EXCEPTION 'Cross-account booking leaked';END IF;
 SELECT count(*) INTO n FROM citizen_supplement_items WHERE application_id='__SELFTEST_SUPPLEMENT_ITEM__';
 IF n<>0 THEN RAISE EXCEPTION 'Cross-account supplement leaked';END IF;
 IF citizen_answer_supplement_item('eeeeeeee-0000-4000-8000-000000000002','Ghi đè dữ liệu',NULL) THEN
  RAISE EXCEPTION 'Another citizen changed supplement response';END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Citizen counter, supplement, access-control tests passed (rolled back)' AS result;
