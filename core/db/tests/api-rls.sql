-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- API RLS: chạy dưới vai JWT thực tế của PostgREST; toàn bộ trong transaction.
-- Các claim dưới đây chỉ là mô phỏng cho kiểm thử SQL; kiểm thử HTTP
-- tenant-isolation.sh kiểm chữ ký token thực qua Keycloak/APISIX.
\set ON_ERROR_STOP on
BEGIN;

-- Kiểm tra mọi bảng nghiệp vụ có tenant_id đều ENABLE và FORCE RLS;
-- bảng mới thêm cũng phải qua kiểm thử này, không thể chỉ kiểm danh sách cố định.
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT format('%I.%I', n.nspname, c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND a.attname = 'tenant_id' AND NOT a.attisdropped
      AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)
  LOOP
    RAISE EXCEPTION 'RLS chưa bật/ép buộc trên bảng %', table_name;
  END LOOP;
  RAISE NOTICE 'PASS: mọi bảng có tenant_id đều ENABLE/FORCE RLS';
END $$;

SET LOCAL ROLE "commune-app";
SELECT set_config('request.jwt.claims',
  '{"azp":"commune-app","tenant_id":"xa-a","realm_access":{"roles":["receptionist"]}}', true);

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM api.dossiers;
  IF n = 0 THEN RAISE EXCEPTION 'Xã A không có hồ sơ mẫu'; END IF;
  IF EXISTS(SELECT 1 FROM api.dossiers WHERE tenant_code <> 'xa-a') THEN
    RAISE EXCEPTION 'JWT xã A nhìn thấy hồ sơ xã khác';
  END IF;
  IF EXISTS(SELECT 1 FROM api.dossiers WHERE id = 'HS-2026-008888') THEN
    RAISE EXCEPTION 'JWT xã A nhìn thấy hồ sơ xã B qua ID';
  END IF;
  IF EXISTS(SELECT 1 FROM applications WHERE tenant_id <>
    '10000000-0000-4000-8000-000000000001'::uuid) THEN
    RAISE EXCEPTION 'Quyền SELECT bảng gốc đã làm lộ hồ sơ xã B';
  END IF;
  RAISE NOTICE 'PASS: xã A chỉ đọc hồ sơ xã A qua view và bảng gốc';
END $$;

SELECT set_config('request.jwt.claims',
  '{"azp":"commune-app","tenant_id":"xa-b","realm_access":{"roles":["receptionist"]}}', true);
DO $$
BEGIN
  IF (SELECT count(*) FROM api.dossiers) <> 1 OR
     NOT EXISTS (SELECT 1 FROM api.dossiers WHERE id = 'HS-2026-008888') THEN
    RAISE EXCEPTION 'JWT xã B không thấy đúng hồ sơ của mình';
  END IF;
  IF EXISTS (SELECT 1 FROM api.dossiers WHERE tenant_code <> 'xa-b') THEN
    RAISE EXCEPTION 'JWT xã B nhìn thấy hồ sơ xã khác';
  END IF;
  RAISE NOTICE 'PASS: xã B chỉ đọc hồ sơ xã B';
END $$;

SELECT set_config('request.jwt.claims',
  '{"azp":"commune-app","tenant_id":"xa-a","realm_access":{"roles":["supervisor"]}}', true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM applications) OR EXISTS (SELECT 1 FROM api.dossiers)
    OR EXISTS (SELECT 1 FROM api.dossier_events)
    OR EXISTS (SELECT 1 FROM api.dossier_documents) THEN
    RAISE EXCEPTION 'supervisor đọc được dữ liệu hồ sơ';
  END IF;
  RAISE NOTICE 'PASS: supervisor không đọc được bảng/view hồ sơ';
END $$;

ROLLBACK;
