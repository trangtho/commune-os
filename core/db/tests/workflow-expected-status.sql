-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Regression test: stale workflow precondition must not write a dossier. Roll back all fixture changes.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  v_id text;
  v_status text;
BEGIN
  SELECT a.id,a.status INTO v_id,v_status FROM applications a JOIN tenants t ON t.id=coalesce(a.receiving_tenant_id,a.tenant_id)
    WHERE t.code='xa-a' AND a.status='processing' ORDER BY a.id LIMIT 1;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Chạy make demo trước khi kiểm thử workflow'; END IF;
  UPDATE core_settings SET value=encode(sha256(convert_to('workflow-test-key','UTF8')),'hex') WHERE key='workflow_token_sha256';
  PERFORM set_config('request.jwt.claims','{"tenant_id":"xa-a","realm_access":{"roles":["officer"]},"preferred_username":"workflow-test"}',true);
  PERFORM set_config('request.headers','{"x-workflow-token":"workflow-test-key","x-workflow-expected-status":"supplement"}',true);
  BEGIN
    PERFORM api.set_dossier_status(v_id,'completed','workflow stale test');
    RAISE EXCEPTION 'LỖI: trạng thái kỳ vọng cũ được chấp nhận';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  IF (SELECT status FROM applications WHERE id=v_id) <> v_status THEN RAISE EXCEPTION 'LỖI: hồ sơ bị thay đổi'; END IF;
  RAISE NOTICE 'ĐẠT: stale workflow precondition bị từ chối và không sửa hồ sơ';
END $$;
ROLLBACK;
