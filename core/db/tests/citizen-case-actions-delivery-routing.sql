-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Run after db-setup. Transactions roll back both data and staff actions.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF has_table_privilege('communeos_app','citizen_case_requests','UPDATE') THEN
  RAISE EXCEPTION 'Citizen may not approve case requests'; END IF;
 IF has_table_privilege('communeos_app','citizen_case_transfer_handoffs','INSERT') THEN
  RAISE EXCEPTION 'Citizen may not initiate staff transfer'; END IF;
 IF has_table_privilege('communeos_app','citizen_result_channels','INSERT') THEN
  RAISE EXCEPTION 'Citizen may not publish result delivery policies'; END IF;
END $$;
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,form_data,due_at)
VALUES('__SELFTEST_CASE_ACTION__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','khai-sinh','processing','Người kiểm thử','{}',CURRENT_DATE-1);
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,form_data,due_at)
VALUES('__SELFTEST_CASE_TRANSFER__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','khai-sinh','processing','Người kiểm thử','{}',CURRENT_DATE+1);
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,form_data,due_at)
VALUES('__SELFTEST_CASE_DELIVERY__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','khai-sinh','completed','Người kiểm thử','{}',CURRENT_DATE-1);
SELECT citizen_staff_publish_result_channel('khai-sinh',
 '10000000-0000-4000-8000-000000000001','counter','TEST-LEGAL-APPROVAL',
 now()+interval '30 days','Nhận tại bộ phận một cửa');
INSERT INTO citizen_procedure_receivers(procedure_id,source_tenant_id,receiving_tenant_id,enabled,approval_reference,valid_until)
VALUES('khai-sinh','10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002',true,'TEST-ROUTING-PROVISION',now()+interval '30 days')
ON CONFLICT(procedure_id,source_tenant_id,receiving_tenant_id)
DO UPDATE SET enabled=true,approval_reference='TEST-ROUTING-PROVISION',valid_until=now()+interval '30 days';
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
INSERT INTO citizen_case_requests(application_id,citizen_id,tenant_id,request_kind,reason)
VALUES('__SELFTEST_CASE_ACTION__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','withdrawal','Xin rút hồ sơ do không còn nhu cầu làm thủ tục.');
INSERT INTO citizen_case_requests(application_id,citizen_id,tenant_id,request_kind,reason,proposed_tenant_id)
VALUES('__SELFTEST_CASE_TRANSFER__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','transfer','Đề nghị chuyển đúng địa phương tiếp nhận',
 '10000000-0000-4000-8000-000000000002');
INSERT INTO citizen_case_deliveries(application_id,citizen_id,tenant_id,method)
VALUES('__SELFTEST_CASE_DELIVERY__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','counter');
INSERT INTO citizen_deadline_alerts(application_id,citizen_id,tenant_id,alert_level)
VALUES('__SELFTEST_CASE_ACTION__','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','overdue');
DO $$ BEGIN
 IF (SELECT count(*) FROM citizen_case_requests WHERE application_id LIKE '__SELFTEST_CASE_%')<>2 THEN
  RAISE EXCEPTION 'Owner cannot read case requests'; END IF;
 IF (SELECT count(*) FROM citizen_deadline_alerts WHERE application_id='__SELFTEST_CASE_ACTION__')<>1 THEN
  RAISE EXCEPTION 'Owner cannot read deadline alert'; END IF;
END $$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM citizen_case_requests WHERE application_id LIKE '__SELFTEST_CASE_%') THEN
  RAISE EXCEPTION 'Cross-tenant citizen sees private requests'; END IF;
 IF EXISTS(SELECT 1 FROM citizen_deadline_alerts WHERE application_id='__SELFTEST_CASE_ACTION__') THEN
  RAISE EXCEPTION 'Cross-tenant citizen sees private deadline'; END IF;
 IF EXISTS(SELECT 1 FROM citizen_case_deliveries WHERE application_id='__SELFTEST_CASE_DELIVERY__') THEN
  RAISE EXCEPTION 'Cross-account citizen sees result method'; END IF;
 IF EXISTS(SELECT 1 FROM citizen_case_transfer_handoffs WHERE application_id='__SELFTEST_CASE_TRANSFER__') THEN
  RAISE EXCEPTION 'Cross-tenant citizen sees private transfers'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE withdrawal uuid;transfer uuid;handoff uuid; accepted boolean; BEGIN
 IF citizen_staff_update_delivery('__SELFTEST_CASE_DELIVERY__','10000000-0000-4000-8000-000000000002',
  'staff-wrong','ready','','Tình trạng cập nhật sai xã') THEN
  RAISE EXCEPTION 'Wrong locality changed delivery'; END IF;
 IF NOT citizen_staff_update_delivery('__SELFTEST_CASE_DELIVERY__','10000000-0000-4000-8000-000000000001',
  'staff-test','ready','','Kết quả đã sẵn sàng tại quầy') THEN
  RAISE EXCEPTION 'Authorized staff could not confirm ready result'; END IF;
 SELECT id INTO withdrawal FROM citizen_case_requests WHERE application_id='__SELFTEST_CASE_ACTION__';
 IF citizen_staff_decide_case_request(withdrawal,'10000000-0000-4000-8000-000000000002',
   'staff-test',true,'Lý do kiểm thử về thẩm quyền') THEN
  RAISE EXCEPTION 'Wrong tenant approved withdrawal'; END IF;
 IF NOT citizen_staff_decide_case_request(withdrawal,'10000000-0000-4000-8000-000000000001',
   'staff-test',true,'Đồng ý rút hồ sơ theo quy định') THEN
  RAISE EXCEPTION 'Authorized staff withdrawal failed'; END IF;
 IF (SELECT status FROM applications WHERE id='__SELFTEST_CASE_ACTION__')<>'withdrawn' THEN
  RAISE EXCEPTION 'Approved withdrawal did not update application'; END IF;
 SELECT id INTO transfer FROM citizen_case_requests WHERE application_id='__SELFTEST_CASE_TRANSFER__';
 handoff:=citizen_staff_start_case_transfer(transfer,'10000000-0000-4000-8000-000000000001',
  'staff-test','Chuyển theo tuyến đã phê duyệt');
 IF handoff IS NULL THEN RAISE EXCEPTION 'Staff transfer not started'; END IF;
 IF citizen_staff_accept_case_transfer(handoff,'10000000-0000-4000-8000-000000000001',
   'staff-test',true,'Không phải đơn vị nhận') THEN
  RAISE EXCEPTION 'Source tenant accepted its own transfer'; END IF;
 SELECT receiving_tenant_id='10000000-0000-4000-8000-000000000002' INTO accepted
 FROM applications WHERE id='__SELFTEST_CASE_TRANSFER__';
 IF accepted THEN RAISE EXCEPTION 'Application moved before destination confirmation'; END IF;
 IF NOT citizen_staff_accept_case_transfer(handoff,'10000000-0000-4000-8000-000000000002',
   'staff-destination',true,'Đã xác minh điều kiện và đồng ý tiếp nhận') THEN
  RAISE EXCEPTION 'Destination tenant could not accept transfer'; END IF;
 IF (SELECT receiving_tenant_id FROM applications WHERE id='__SELFTEST_CASE_TRANSFER__')
   <>'10000000-0000-4000-8000-000000000002'::uuid THEN
   RAISE EXCEPTION 'Receiving tenant did not change after confirmation'; END IF;
END $$;
ROLLBACK;
SELECT 'Citizen deadline, case action and routing rights passed (rolled back)' AS result;
