-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Test on prepared demo data, roll back all changes.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF has_table_privilege('communeos_app','citizen_procedure_guidance_rules','INSERT') THEN
    RAISE EXCEPTION 'Citizen role must not approve or add match rules'; END IF;
  IF has_table_privilege('communeos_app','citizen_procedure_guidance_rules','UPDATE') THEN
    RAISE EXCEPTION 'Citizen role must not approve or update match rules'; END IF;
END $$;
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
INSERT INTO citizen_service_batches(id,citizen_id,tenant_id,title,purpose,shared_consent,shared_data)
 VALUES('bbbbbbbb-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','Nhóm kiểm thử A','Kiểm thử',false,'{}');
INSERT INTO citizen_service_batch_items(batch_id,procedure_id,position)
 VALUES('bbbbbbbb-0000-4000-8000-000000000001','khai-sinh',1),
       ('bbbbbbbb-0000-4000-8000-000000000001','xac-nhan-cu-tru',2);
DO $$ DECLARE n integer; BEGIN
 -- Chỉ kiểm tra dữ liệu do bài kiểm thử tạo: công dân mẫu có thể đã có nhóm thủ tục thật trên máy.
 SELECT count(*) INTO n FROM citizen_service_batches WHERE id='bbbbbbbb-0000-4000-8000-000000000001';
 IF n<>1 THEN RAISE EXCEPTION 'Expected only owner batch, got %',n; END IF;
 SELECT count(*) INTO n FROM citizen_service_batches WHERE citizen_id<>'20000000-0000-4000-8000-000000000001';
 IF n<>0 THEN RAISE EXCEPTION 'Owner sees batches of other citizens: %',n; END IF;
 SELECT count(*) INTO n FROM citizen_service_batch_items WHERE batch_id='bbbbbbbb-0000-4000-8000-000000000001';
 IF n<>2 THEN RAISE EXCEPTION 'Expected two owner batch components, got %',n; END IF;
 BEGIN
  UPDATE citizen_service_batch_items SET application_id='HS-2026-008888'
  WHERE batch_id='bbbbbbbb-0000-4000-8000-000000000001' AND procedure_id='khai-sinh';
  RAISE EXCEPTION 'Foreign account application must be blocked';
 EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
 END;
END $$;
RESET ROLE;
INSERT INTO citizen_service_batches(id,citizen_id,tenant_id,title)
 VALUES('bbbbbbbb-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',
 '10000000-0000-4000-8000-000000000002','Nhóm kiểm thử B');
SET LOCAL ROLE communeos_app;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM citizen_service_batches WHERE id='bbbbbbbb-0000-4000-8000-000000000002';
 IF n<>1 THEN RAISE EXCEPTION 'Account B must see its own batch, got %',n; END IF;
 SELECT count(*) INTO n FROM citizen_service_batches WHERE citizen_id<>'20000000-0000-4000-8000-000000000002';
 IF n<>0 THEN RAISE EXCEPTION 'Account B must only see B batches, got %',n; END IF;
 SELECT count(*) INTO n FROM citizen_service_batch_items WHERE batch_id='bbbbbbbb-0000-4000-8000-000000000001';
 IF n<>0 THEN RAISE EXCEPTION 'Account B must not see A batch items'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Citizen guidance and batches RLS test passed (all changes rolled back)' AS result;
