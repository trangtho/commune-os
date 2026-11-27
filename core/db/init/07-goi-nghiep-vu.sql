-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Gói nghiệp vụ (modules/<tên>/module.json) chạy trên lõi.
--   * core_modules: gói đã cài, do core/db/migrate.sh ghi sau khi chạy xong SQL của gói.
--   * core_request_hooks: hàm của gói chạy đầu mỗi yêu cầu PostgREST (ví dụ gói xã đặt biến RLS của công dân
--     từ token). PostgREST gọi public.rest_pre_request() (PGRST_DB_PRE_REQUEST), hàm này gọi lần lượt các móc.
--   * api.modules, api.public_platform(): xem gói đã cài; public_platform gọi được khi chưa đăng nhập
--     (cổng API dùng để kiểm tra sức khỏe cả chuỗi cổng → PostgREST → PostgreSQL).
-- Chạy lại nhiều lần không lỗi.

CREATE TABLE IF NOT EXISTS core_modules (
  name         text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9-]{0,62}$'),
  title        text NOT NULL,
  version      text NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON core_modules FROM PUBLIC;

CREATE TABLE IF NOT EXISTS core_request_hooks (
  module text PRIMARY KEY,
  fn     text NOT NULL CHECK (fn ~ '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$')   -- schema.tên_hàm, không tham số
);
REVOKE ALL ON core_request_hooks FROM PUBLIC;

-- Gói ghi danh móc của mình: SELECT public.register_request_hook('<tên gói>', 'public.<hàm>');
CREATE OR REPLACE FUNCTION public.register_request_hook(p_module text, p_fn text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO core_request_hooks (module, fn) VALUES (p_module, p_fn)
  ON CONFLICT (module) DO UPDATE SET fn = EXCLUDED.fn
$$;
REVOKE ALL ON FUNCTION public.register_request_hook(text, text) FROM PUBLIC;

-- Đầu mỗi yêu cầu PostgREST (sau khi đã kiểm chữ ký token). Không có móc nào thì không làm gì.
CREATE OR REPLACE FUNCTION public.rest_pre_request() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE h record;
BEGIN
  FOR h IN SELECT hook.fn FROM core_request_hooks hook JOIN core_modules m ON m.name = hook.module ORDER BY hook.module LOOP
    IF to_regprocedure(h.fn || '()') IS NOT NULL THEN
      EXECUTE format('SELECT %s()', h.fn);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.rest_pre_request() FROM PUBLIC;

DROP VIEW IF EXISTS api.modules;
CREATE VIEW api.modules AS
SELECT name, title, version, installed_at, updated_at FROM core_modules ORDER BY name;

CREATE OR REPLACE FUNCTION api.public_platform() RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object('name', 'CommuneOS',
    'modules', coalesce((SELECT json_agg(json_build_object('name', name, 'version', version) ORDER BY name)
                         FROM core_modules), '[]'::json))
$$;
REVOKE ALL ON FUNCTION api.public_platform() FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.modules TO "commune-app";
    GRANT EXECUTE ON FUNCTION public.rest_pre_request(), api.public_platform() TO "commune-app";
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
    GRANT EXECUTE ON FUNCTION public.rest_pre_request(), api.public_platform() TO web_anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
