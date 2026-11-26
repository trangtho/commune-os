-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Thủ tục theo xã.
-- Danh mục thủ tục là chung cho cả hệ thống (nạp bằng gói thủ tục pack.yaml).
-- Mỗi xã chỉ nhận hồ sơ cho những thủ tục mà quản trị hệ thống đã BẬT cho xã đó.
--   - Cán bộ xã chỉ thấy thủ tục đã bật cho xã mình (API /rest/procedures).
--   - Người dân không nộp được hồ sơ cho thủ tục chưa bật ở xã tiếp nhận:
--     cơ sở dữ liệu tự chặn, ứng dụng nào gọi cũng vậy (Poka-yoke).
-- Chạy lại nhiều lần không lỗi.

-- ===== 1. Bảng bật/tắt thủ tục theo xã =====
CREATE TABLE IF NOT EXISTS tenant_procedures (
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  procedure_id text NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  enabled_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, procedure_id)
);
REVOKE ALL ON tenant_procedures FROM PUBLIC;

ALTER TABLE procedures ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0.0';
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Lần đầu chạy: bật mọi thủ tục đang công bố cho mọi xã hiện có, để dữ liệu mẫu chạy như cũ.
-- Đánh dấu đã làm, để những lần chạy sau không bật lại thủ tục mà quản trị đã tắt.
CREATE TABLE IF NOT EXISTS core_settings (key text PRIMARY KEY, value text NOT NULL);
REVOKE ALL ON core_settings FROM PUBLIC;
DO $$ BEGIN
  -- Chỉ làm khi đã có xã (lần khởi tạo database đầu tiên chưa có dữ liệu mẫu).
  IF NOT EXISTS (SELECT 1 FROM core_settings WHERE key = 'tenant_procedures_seeded')
     AND EXISTS (SELECT 1 FROM tenants) THEN
    INSERT INTO tenant_procedures (tenant_id, procedure_id)
    SELECT t.id, p.id FROM tenants t CROSS JOIN procedures p WHERE p.published
    ON CONFLICT DO NOTHING;
    INSERT INTO core_settings (key, value) VALUES ('tenant_procedures_seeded', now()::text);
  END IF;
END $$;

-- ===== 2. Chặn nộp hồ sơ cho thủ tục chưa bật ở xã tiếp nhận =====
-- Áp dụng khi tạo hồ sơ và khi hồ sơ chuyển từ bản nháp sang nộp.
-- Bỏ qua với tài khoản quản trị database (nạp dữ liệu mẫu, bảo trì).
CREATE OR REPLACE FUNCTION public.check_procedure_enabled() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := coalesce(NEW.receiving_tenant_id, NEW.tenant_id);
BEGIN
  IF (SELECT rolsuper FROM pg_roles WHERE rolname = session_user) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NOT (OLD.status = 'draft' AND NEW.status <> 'draft')
     AND OLD.procedure_id = NEW.procedure_id
     AND coalesce(OLD.receiving_tenant_id, OLD.tenant_id) = v_tenant THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tenant_procedures tp JOIN procedures p ON p.id = tp.procedure_id
                  WHERE tp.tenant_id = v_tenant AND tp.procedure_id = NEW.procedure_id
                    AND p.published) THEN
    RAISE EXCEPTION 'Xã tiếp nhận chưa mở thủ tục này. Vui lòng chọn thủ tục khác hoặc liên hệ UBND xã.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS check_procedure_enabled ON applications;
CREATE TRIGGER check_procedure_enabled BEFORE INSERT OR UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION public.check_procedure_enabled();

-- Cho Kênh người dân hỏi "xã này có mở thủ tục này không" (không lộ gì khác).
CREATE OR REPLACE FUNCTION public.procedure_enabled_for(p_tenant uuid, p_procedure text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM tenant_procedures WHERE tenant_id = p_tenant AND procedure_id = p_procedure)
$$;
REVOKE ALL ON FUNCTION public.procedure_enabled_for(uuid, text) FROM PUBLIC;

-- ===== 3. API =====
-- Danh mục thủ tục: quản trị thấy tất cả kèm danh sách xã đã bật;
-- cán bộ chỉ thấy thủ tục đang công bố và đã bật cho xã mình.
DROP VIEW IF EXISTS api.procedures;
CREATE VIEW api.procedures AS
SELECT p.id, p.title, p.category, p.summary, p.icon, p.sla_days, p.fee_note,
       p.instructions, p.published, p.version, p.updated_at,
       CASE WHEN public.is_sys_admin() THEN
         coalesce((SELECT array_agg(t.code ORDER BY t.code) FROM tenant_procedures tp
                    JOIN tenants t ON t.id = tp.tenant_id WHERE tp.procedure_id = p.id), '{}')
       END AS enabled_tenants
FROM procedures p
WHERE public.is_sys_admin()
   OR (p.published AND EXISTS (SELECT 1 FROM tenant_procedures tp JOIN tenants t ON t.id = tp.tenant_id
                                WHERE tp.procedure_id = p.id AND t.code = public.current_tenant_code()))
ORDER BY p.category, p.title;

-- Bật / tắt một thủ tục cho một xã (chỉ sys_admin).
-- Gọi: POST /rest/rpc/set_tenant_procedure {"tenant_code":"xa-b","procedure_id":"khai-sinh","enabled":false}
CREATE OR REPLACE FUNCTION api.set_tenant_procedure(tenant_code text, procedure_id text, enabled boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid;
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được bật/tắt thủ tục' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_tenant FROM tenants t WHERE t.code = set_tenant_procedure.tenant_code;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy xã %', tenant_code USING ERRCODE = 'PT404';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM procedures p WHERE p.id = set_tenant_procedure.procedure_id) THEN
    RAISE EXCEPTION 'Không tìm thấy thủ tục %', procedure_id USING ERRCODE = 'PT404';
  END IF;
  IF enabled THEN
    INSERT INTO tenant_procedures (tenant_id, procedure_id)
    VALUES (v_tenant, set_tenant_procedure.procedure_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM tenant_procedures tp
     WHERE tp.tenant_id = v_tenant AND tp.procedure_id = set_tenant_procedure.procedure_id;
  END IF;
  RETURN json_build_object('tenant_code', tenant_code, 'procedure_id', procedure_id, 'enabled', enabled);
END $$;

-- Bật / tắt nhiều thủ tục cho một xã trong một lần (nút "Mở tất cả", "Tắt tất cả"; chỉ sys_admin).
-- Gọi: POST /rest/rpc/set_tenant_procedures {"tenant_code":"xa-b","procedure_ids":["khai-sinh","ket-hon"],"enabled":true}
CREATE OR REPLACE FUNCTION api.set_tenant_procedures(tenant_code text, procedure_ids text[], enabled boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_count integer;
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được bật/tắt thủ tục' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO v_tenant FROM tenants t WHERE t.code = set_tenant_procedures.tenant_code;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy xã %', tenant_code USING ERRCODE = 'PT404';
  END IF;
  IF enabled THEN
    INSERT INTO tenant_procedures (tenant_id, procedure_id)
    SELECT v_tenant, p.id FROM procedures p WHERE p.id = ANY (procedure_ids)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM tenant_procedures tp WHERE tp.tenant_id = v_tenant AND tp.procedure_id = ANY (procedure_ids);
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('tenant_code', tenant_code, 'changed', v_count, 'enabled', enabled);
END $$;

-- Bật / tắt một thủ tục cho nhiều xã (nút "Mở cho tất cả xã" ở trang chi tiết thủ tục; chỉ sys_admin).
-- Gọi: POST /rest/rpc/set_procedure_tenants {"procedure_id":"khai-sinh","tenant_codes":["xa-a","xa-b"],"enabled":true}
CREATE OR REPLACE FUNCTION api.set_procedure_tenants(procedure_id text, tenant_codes text[], enabled boolean)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được bật/tắt thủ tục' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM procedures p WHERE p.id = set_procedure_tenants.procedure_id) THEN
    RAISE EXCEPTION 'Không tìm thấy thủ tục %', procedure_id USING ERRCODE = 'PT404';
  END IF;
  IF enabled THEN
    INSERT INTO tenant_procedures (tenant_id, procedure_id)
    SELECT t.id, set_procedure_tenants.procedure_id FROM tenants t WHERE t.code = ANY (tenant_codes)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM tenant_procedures tp USING tenants t
     WHERE tp.tenant_id = t.id AND t.code = ANY (tenant_codes)
       AND tp.procedure_id = set_procedure_tenants.procedure_id;
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('procedure_id', procedure_id, 'changed', v_count, 'enabled', enabled);
END $$;

-- Nạp hoặc cập nhật một thủ tục từ gói thủ tục (pack.yaml đã đọc thành JSON, chỉ sys_admin).
-- Gọi: POST /rest/rpc/import_procedure {"pack": {...}}
-- Thủ tục mới chưa bật cho xã nào; quản trị bật cho từng xã sau khi kiểm tra.
CREATE OR REPLACE FUNCTION api.import_procedure(pack jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code    text := pack ->> 'code';
  v_name    text := btrim(coalesce(pack ->> 'name', ''));
  v_version text := btrim(coalesce(pack ->> 'version', ''));
  v_hours   integer;
  v_doc     jsonb;
  v_new     boolean;
BEGIN
  IF NOT public.is_sys_admin() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống được nạp thủ tục' USING ERRCODE = '42501';
  END IF;
  IF v_code IS NULL OR v_code !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Mã thủ tục chỉ gồm chữ thường không dấu, số và dấu gạch ngang' USING ERRCODE = '22023';
  END IF;
  IF v_name = '' OR v_version !~ '^[0-9]+\.[0-9]+\.[0-9]+$' THEN
    RAISE EXCEPTION 'Gói thủ tục thiếu tên hoặc phiên bản dạng 1.0.0' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM procedures p WHERE p.id = v_code AND p.version = v_version) THEN
    RAISE EXCEPTION 'Thủ tục "%" phiên bản % đã có trong hệ thống', v_code, v_version USING ERRCODE = '23505';
  END IF;
  v_hours := greatest(coalesce((pack ->> 'sla_hours')::integer, 8), 1);
  v_new := NOT EXISTS (SELECT 1 FROM procedures p WHERE p.id = v_code);

  INSERT INTO procedures (id, title, category, summary, sla_days, fee_note, instructions, published, version, updated_at)
  VALUES (v_code, v_name, coalesce(nullif(pack ->> 'category', ''), 'Khác'),
          coalesce(nullif(pack ->> 'summary', ''), v_name), ceil(v_hours / 8.0)::integer,
          coalesce(nullif(pack ->> 'fee', ''), 'Theo quy định'), coalesce(pack ->> 'instructions', ''),
          true, v_version, now())
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, category = EXCLUDED.category, summary = EXCLUDED.summary,
    sla_days = EXCLUDED.sla_days, fee_note = EXCLUDED.fee_note,
    instructions = EXCLUDED.instructions, version = EXCLUDED.version, updated_at = now();

  DELETE FROM procedure_documents d WHERE d.procedure_id = v_code;
  FOR v_doc IN SELECT * FROM jsonb_array_elements(coalesce(pack -> 'required_documents', '[]'::jsonb)) LOOP
    IF coalesce(v_doc ->> 'code', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR coalesce(v_doc ->> 'name', '') = '' THEN
      RAISE EXCEPTION 'Giấy tờ trong gói thiếu mã hoặc tên' USING ERRCODE = '22023';
    END IF;
    INSERT INTO procedure_documents (procedure_id, document_code, document_name, is_required)
    VALUES (v_code, v_doc ->> 'code', v_doc ->> 'name', coalesce((v_doc ->> 'required')::boolean, true));
  END LOOP;

  RETURN json_build_object('id', v_code, 'version', v_version, 'created', v_new);
END $$;

REVOKE ALL ON FUNCTION api.set_tenant_procedure(text, text, boolean), api.import_procedure(jsonb),
  api.set_tenant_procedures(text, text[], boolean), api.set_procedure_tenants(text, text[], boolean) FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT SELECT ON api.procedures TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.set_tenant_procedure(text, text, boolean),
      api.import_procedure(jsonb), api.set_tenant_procedures(text, text[], boolean),
      api.set_procedure_tenants(text, text[], boolean) TO "commune-app";
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'communeos_app') THEN
    GRANT EXECUTE ON FUNCTION public.procedure_enabled_for(uuid, text) TO communeos_app;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
