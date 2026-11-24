-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kênh người dân gọi lõi bằng vai trò citizen-app (token công dân qua PostgREST); communeos_app không còn quyền dữ liệu.
-- Integration test; run after db-setup. ALL test changes are rolled back.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO citizen_vault_documents(id,citizen_id,tenant_id,title,category)
VALUES('e1000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Giấy tờ của A','identity'),
      ('e1000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Giấy tờ của B','identity');
INSERT INTO citizen_vault_versions(id,document_id,version_no,original_name,storage_key,mime_type,size_bytes,sha256)
VALUES('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',1,'a.pdf','a1000000-0000-4000-8000-000000000001.pdf','application/pdf',123,repeat('a',64)),
      ('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002',1,'b.pdf','a1000000-0000-4000-8000-000000000002.pdf','application/pdf',123,repeat('b',64));
DO $$ BEGIN
 IF has_table_privilege('citizen-app','citizen_vault_shares','DELETE') THEN RAISE EXCEPTION 'No delete share audit'; END IF;
END $$;
SET LOCAL ROLE "citizen-app";
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000001',true);
-- Kiểm tra theo giấy tờ do chính test tạo, không phụ thuộc giấy tờ người dùng đã tải lên trước đó.
DO $$DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM citizen_vault_documents WHERE id='e1000000-0000-4000-8000-000000000001';
 IF n<>1 THEN RAISE EXCEPTION 'A should see own test document: %',n; END IF;
 SELECT count(*) INTO n FROM citizen_vault_documents WHERE citizen_id<>'20000000-0000-4000-8000-000000000001';
 IF n<>0 THEN RAISE EXCEPTION 'A must see no document of another citizen: %',n; END IF;
 SELECT count(*) INTO n FROM citizen_vault_versions WHERE id='e2000000-0000-4000-8000-000000000001';
 IF n<>1 THEN RAISE EXCEPTION 'A should see own test version: %',n; END IF;
 SELECT count(*) INTO n FROM citizen_vault_versions WHERE id='e2000000-0000-4000-8000-000000000002';
 IF n<>0 THEN RAISE EXCEPTION 'A must not see B version'; END IF;
 UPDATE citizen_vault_documents SET title='Hacked' WHERE id='e1000000-0000-4000-8000-000000000002';
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'A must not edit B document'; END IF;
END $$;
SELECT set_config('app.citizen_id','20000000-0000-4000-8000-000000000002',true);
SELECT set_config('app.tenant_id','10000000-0000-4000-8000-000000000002',true);
DO $$DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM citizen_vault_versions WHERE id='e2000000-0000-4000-8000-000000000002';
 IF n<>1 THEN RAISE EXCEPTION 'B should see own test version: %',n; END IF;
 SELECT count(*) INTO n FROM citizen_vault_versions WHERE id='e2000000-0000-4000-8000-000000000001';
 IF n<>0 THEN RAISE EXCEPTION 'B must not see A version'; END IF;
 SELECT count(*) INTO n FROM citizen_vault_documents WHERE citizen_id<>'20000000-0000-4000-8000-000000000002';
 IF n<>0 THEN RAISE EXCEPTION 'B must see no document of another citizen: %',n; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'citizen vault RLS checks passed' AS result;
