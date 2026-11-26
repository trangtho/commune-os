-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
-- PostgreSQL integration test after migration 16; transaction ALWAYS rolls back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM citizen_procedure_versions WHERE procedure_id='chung-thuc' AND version_no=1)
 THEN RAISE EXCEPTION 'Missing initial procedure baseline'; END IF;
 IF has_table_privilege('citizen-app','citizen_data_access_events','DELETE')
 OR has_table_privilege('citizen-app','citizen_procedure_versions','UPDATE')
 OR has_table_privilege('citizen-app','citizen_consent_events','UPDATE')
 THEN RAISE EXCEPTION 'Append-only / procedure history must not be editable by app role'; END IF;
END $$;
-- A and B cannot read each other's consents or audit events.
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
INSERT INTO citizen_consent_events(citizen_id,tenant_id,purpose_id,decision,valid_until)
VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
'vault_case_reuse','granted',now()+interval '1 day');
INSERT INTO citizen_data_access_events(citizen_id,tenant_id,action,purpose,processing_unit,resource_kind,actor_kind)
VALUES('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
'view_profile','Kiểm thử','Citizen Portal','profile','citizen');
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM citizen_consent_events;
 IF n<1 THEN RAISE EXCEPTION 'A consent invisible'; END IF;
 SELECT count(*) INTO n FROM citizen_data_access_events WHERE
 event_hash<>citizen_data_event_digest(citizen_id,tenant_id,action,purpose,
 processing_unit,resource_kind,resource_reference,actor_kind,occurred_at,previous_hash);
 IF n<>0 THEN RAISE EXCEPTION 'Audit digest mismatch'; END IF;
END $$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM citizen_consent_events WHERE purpose_id='vault_case_reuse')
 OR EXISTS(SELECT 1 FROM citizen_data_access_events WHERE action='view_profile')
 THEN RAISE EXCEPTION 'Tenant isolation failed'; END IF;
END $$;
RESET ROLE;
-- Staff publication updates catalog + notifications in the same transaction.
INSERT INTO applications(id,citizen_id,tenant_id,procedure_id,status,applicant_name,procedure_version_id,acknowledged_procedure_version_id)
SELECT 'HS-2026-TEST-REVISION','20000000-0000-4000-8000-000000000001',
'10000000-0000-4000-8000-000000000001','chung-thuc','draft','Công dân thử nghiệm',v.id,v.id
FROM citizen_procedure_versions v WHERE v.procedure_id='chung-thuc' AND v.version_no=1;
SELECT citizen_publish_procedure_version('chung-thuc',jsonb_build_object(
 'title','Chứng thực bản sao (mô phỏng 2)','summary','Thông tin cập nhật bản mô phỏng',
 'instructions','Đối chiếu tài liệu và yêu cầu theo văn bản mới.',
 'feeNote','Phí bản mô phỏng thay đổi','slaDays',2,'formRevision','v2',
 'documents',jsonb_build_array(jsonb_build_object('documentCode','ban-chinh','documentName','Giấy tờ gốc mới','isRequired',true)),
 'sourceUrl','https://vbpl.vn/','sourceTitle','Nguồn thử nghiệm (không phải văn bản thực tế)',
 'sourceReference','TEST-ONLY-2026','issuingAuthority','Cơ quan giả lập',
 'scopeNote','Toàn quốc (chỉ thử nghiệm)','effectiveFrom',CURRENT_DATE::text,'changeNote','Thử thay đổi giấy tờ'),
 'staff-test');
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM citizen_procedure_change_notices WHERE application_id='HS-2026-TEST-REVISION';
 IF n<>1 THEN RAISE EXCEPTION 'Draft notification was not created: %',n; END IF;
 SELECT count(*) INTO n FROM citizen_notifications WHERE application_id='HS-2026-TEST-REVISION' AND category='procedure_change';
 IF n<>1 THEN RAISE EXCEPTION 'Notification inbox missing: %',n; END IF;
END $$;
ROLLBACK;
SELECT 'Procedure version, notice, privacy and isolation checks passed' AS result;
