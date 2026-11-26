-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
-- Run after db-setup. Transactions roll back both data and staff actions.
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
 IF has_table_privilege('citizen-app','citizen_case_requests','UPDATE') THEN
  RAISE EXCEPTION 'Citizen may not approve case requests'; END IF;
 IF has_table_privilege('citizen-app','citizen_case_transfer_handoffs','INSERT') THEN
  RAISE EXCEPTION 'Citizen may not initiate staff transfer'; END IF;
 IF has_table_privilege('citizen-app','citizen_result_channels','INSERT') THEN
  RAISE EXCEPTION 'Citizen may not publish result delivery policies'; END IF;
END $$;
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,form_data,due_at)
VALUES('__SELFTEST_CASE_ACTION__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'khai-sinh','processing','Người kiểm thử','{}',CURRENT_DATE-1);
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,form_data,due_at)
VALUES('__SELFTEST_CASE_TRANSFER__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'khai-sinh','processing','Người kiểm thử','{}',CURRENT_DATE+1);
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,form_data,due_at)
VALUES('__SELFTEST_CASE_DELIVERY__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'khai-sinh','completed','Người kiểm thử','{}',CURRENT_DATE-1);
SELECT citizen_staff_publish_result_channel('khai-sinh',
 current_setting('demo.tenant_a')::uuid,'counter','TEST-LEGAL-APPROVAL',
 now()+interval '30 days','Nhận tại bộ phận một cửa');
INSERT INTO citizen_procedure_receivers(procedure_id,source_tenant_id,receiving_tenant_id,enabled,approval_reference,valid_until)
VALUES('khai-sinh',current_setting('demo.tenant_a')::uuid,
 current_setting('demo.tenant_b')::uuid,true,'TEST-ROUTING-PROVISION',now()+interval '30 days')
ON CONFLICT(procedure_id,source_tenant_id,receiving_tenant_id)
DO UPDATE SET enabled=true,approval_reference='TEST-ROUTING-PROVISION',valid_until=now()+interval '30 days';
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id',current_setting('demo.citizen_a'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_a'),true);
INSERT INTO citizen_case_requests(application_id,citizen_id,tenant_id,request_kind,reason)
VALUES('__SELFTEST_CASE_ACTION__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'withdrawal','Xin rút hồ sơ do không còn nhu cầu làm thủ tục.');
INSERT INTO citizen_case_requests(application_id,citizen_id,tenant_id,request_kind,reason,proposed_tenant_id)
VALUES('__SELFTEST_CASE_TRANSFER__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'transfer','Đề nghị chuyển đúng địa phương tiếp nhận',
 current_setting('demo.tenant_b')::uuid);
INSERT INTO citizen_case_deliveries(application_id,citizen_id,tenant_id,method)
VALUES('__SELFTEST_CASE_DELIVERY__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'counter');
INSERT INTO citizen_deadline_alerts(application_id,citizen_id,tenant_id,alert_level)
VALUES('__SELFTEST_CASE_ACTION__',current_setting('demo.citizen_a')::uuid,
 current_setting('demo.tenant_a')::uuid,'overdue');
DO $$ BEGIN
 IF (SELECT count(*) FROM citizen_case_requests WHERE application_id LIKE '__SELFTEST_CASE_%')<>2 THEN
  RAISE EXCEPTION 'Owner cannot read case requests'; END IF;
 IF (SELECT count(*) FROM citizen_deadline_alerts WHERE application_id='__SELFTEST_CASE_ACTION__')<>1 THEN
  RAISE EXCEPTION 'Owner cannot read deadline alert'; END IF;
END $$;
SELECT set_config('app.citizen_id',current_setting('demo.citizen_b'),true);
SELECT set_config('app.tenant_id',current_setting('demo.tenant_b'),true);
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
 IF citizen_staff_update_delivery('__SELFTEST_CASE_DELIVERY__',current_setting('demo.tenant_b')::uuid,
  'staff-wrong','ready','','Tình trạng cập nhật sai xã') THEN
  RAISE EXCEPTION 'Wrong locality changed delivery'; END IF;
 IF NOT citizen_staff_update_delivery('__SELFTEST_CASE_DELIVERY__',current_setting('demo.tenant_a')::uuid,
  'staff-test','ready','','Kết quả đã sẵn sàng tại quầy') THEN
  RAISE EXCEPTION 'Authorized staff could not confirm ready result'; END IF;
 SELECT id INTO withdrawal FROM citizen_case_requests WHERE application_id='__SELFTEST_CASE_ACTION__';
 IF citizen_staff_decide_case_request(withdrawal,current_setting('demo.tenant_b')::uuid,
   'staff-test',true,'Lý do kiểm thử về thẩm quyền') THEN
  RAISE EXCEPTION 'Wrong tenant approved withdrawal'; END IF;
 IF NOT citizen_staff_decide_case_request(withdrawal,current_setting('demo.tenant_a')::uuid,
   'staff-test',true,'Đồng ý rút hồ sơ theo quy định') THEN
  RAISE EXCEPTION 'Authorized staff withdrawal failed'; END IF;
 IF (SELECT status FROM applications WHERE id='__SELFTEST_CASE_ACTION__')<>'withdrawn' THEN
  RAISE EXCEPTION 'Approved withdrawal did not update application'; END IF;
 SELECT id INTO transfer FROM citizen_case_requests WHERE application_id='__SELFTEST_CASE_TRANSFER__';
 handoff:=citizen_staff_start_case_transfer(transfer,current_setting('demo.tenant_a')::uuid,
  'staff-test','Chuyển theo tuyến đã phê duyệt');
 IF handoff IS NULL THEN RAISE EXCEPTION 'Staff transfer not started'; END IF;
 IF citizen_staff_accept_case_transfer(handoff,current_setting('demo.tenant_a')::uuid,
   'staff-test',true,'Không phải đơn vị nhận') THEN
  RAISE EXCEPTION 'Source tenant accepted its own transfer'; END IF;
 SELECT receiving_tenant_id=current_setting('demo.tenant_b')::uuid INTO accepted
 FROM applications WHERE id='__SELFTEST_CASE_TRANSFER__';
 IF accepted THEN RAISE EXCEPTION 'Application moved before destination confirmation'; END IF;
 IF NOT citizen_staff_accept_case_transfer(handoff,current_setting('demo.tenant_b')::uuid,
   'staff-destination',true,'Đã xác minh điều kiện và đồng ý tiếp nhận') THEN
  RAISE EXCEPTION 'Destination tenant could not accept transfer'; END IF;
 IF (SELECT receiving_tenant_id FROM applications WHERE id='__SELFTEST_CASE_TRANSFER__')
   <>current_setting('demo.tenant_b')::uuid::uuid THEN
   RAISE EXCEPTION 'Receiving tenant did not change after confirmation'; END IF;
END $$;
ROLLBACK;
SELECT 'Citizen deadline, case action and routing rights passed (rolled back)' AS result;
