-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Gói nghiệp vụ (modules/<tên>/module.json) chạy trên lõi.
--   * core_modules: gói đã cài, do core/db/migrate.sh ghi sau khi chạy xong SQL của gói.
--   * core_request_hooks: hàm của gói chạy đầu mỗi yêu cầu PostgREST (ví dụ gói xã đặt biến RLS của công dân
--     từ token). PostgREST gọi public.rest_pre_request() (PGRST_DB_PRE_REQUEST), hàm này gọi lần lượt các móc.
--   * api.modules, api.public_platform(): xem gói đã cài; public_platform gọi được khi chưa đăng nhập
--     (cổng API dùng để kiểm tra sức khỏe cả chuỗi cổng → PostgREST → PostgreSQL).
--   * core_public_rpc: hàm khách chưa đăng nhập được gọi (/public/rpc/<tên>), do gói khai báo ở mục "publicRpc" của
--     module.json (migrate.sh ghi). rest_pre_request() chặn mọi lời gọi khác của khách ngay ở cơ sở dữ liệu, nên cổng API
--     chỉ cần một luật chung /public/rpc/* thay vì liệt kê tên hàm của từng gói.
-- Chạy lại nhiều lần không lỗi.

CREATE TABLE IF NOT EXISTS core_modules (
  name         text PRIMARY KEY CHECK (name ~ '^[a-z][a-z0-9-]{0,62}$'),
  title        text NOT NULL,
  version      text NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON core_modules FROM PUBLIC;

CREATE TABLE IF NOT EXISTS core_public_rpc (
  module text NOT NULL,                                   -- "core" cho hàm công khai của lõi
  name   text NOT NULL CHECK (name ~ '^[a-z_][a-z0-9_]{0,62}$'),
  PRIMARY KEY (name)
);
REVOKE ALL ON core_public_rpc FROM PUBLIC;
INSERT INTO core_public_rpc (module, name) VALUES ('core', 'public_platform') ON CONFLICT (name) DO NOTHING;

-- Đồng bộ hàm công khai của một gói theo module.json (thêm, gỡ hàm không còn khai báo). Tên trùng gói khác thì lỗi.
CREATE OR REPLACE FUNCTION public.public_rpc_sync(p_module text, p_names json) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF EXISTS (SELECT 1 FROM json_array_elements_text(coalesce(p_names, '[]'::json)) n
             JOIN core_public_rpc c ON c.name = n AND c.module <> p_module) THEN
    RAISE EXCEPTION 'Gói % khai báo hàm công khai trùng tên với gói khác', p_module;
  END IF;
  DELETE FROM core_public_rpc c WHERE c.module = p_module
    AND c.name NOT IN (SELECT n FROM json_array_elements_text(coalesce(p_names, '[]'::json)) n);
  INSERT INTO core_public_rpc (module, name)
  SELECT p_module, n FROM json_array_elements_text(coalesce(p_names, '[]'::json)) n
  ON CONFLICT (name) DO NOTHING;
  SELECT count(*) INTO v_count FROM core_public_rpc WHERE module = p_module;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.public_rpc_sync(text, json) FROM PUBLIC;

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

-- Đầu mỗi yêu cầu PostgREST (sau khi đã kiểm chữ ký token).
--   1. Khách chưa đăng nhập (vai trò web_anon) chỉ gọi được hàm trong core_public_rpc và đọc đặc tả OpenAPI (/);
--      dịch vụ của lõi gọi kèm X-Workflow-Token (ai-gateway, đăng ký người dùng, việc định kỳ) thì không bị chặn.
--   2. Gọi lần lượt các móc do gói ghi danh.
CREATE OR REPLACE FUNCTION public.rest_pre_request() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h record;
  v_path text := coalesce(current_setting('request.path', true), '/');
BEGIN
  -- Hàm này SECURITY DEFINER nên current_user là chủ sở hữu; vai trò của yêu cầu là "role" PostgREST đặt (SET LOCAL ROLE).
  IF current_setting('role', true) = 'web_anon' AND v_path <> '/' AND NOT public.is_workflow_call()
     AND NOT EXISTS (SELECT 1 FROM core_public_rpc WHERE '/rpc/' || name = v_path) THEN
    RAISE EXCEPTION 'Không có API công khai này' USING ERRCODE = 'PT404';
  END IF;
  FOR h IN SELECT fn FROM core_request_hooks ORDER BY module LOOP
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
