-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Tệp đính kèm dùng chung cho mọi gói nghiệp vụ (đơn nghỉ phép, đề nghị mua sắm...).
-- Nội dung tệp nằm ở kho đối tượng S3 (dịch vụ files của lõi); ở đây chỉ giữ siêu dữ liệu và mã băm SHA-256.
-- Gói khai báo loại đối tượng được đính kèm trong module.json ("attachments"); dịch vụ files kiểm tra người dùng
-- XEM ĐƯỢC đối tượng qua bảng ảo của gói (bằng token của chính họ, nên RLS của gói quyết định), rồi mới gọi các hàm
-- dưới đây kèm khóa nội bộ X-Workflow-Token. Gọi thẳng /rest/rpc/attachment_* bị từ chối.
-- Mỗi tệp đính kèm ghi một dòng vào sổ ghi nhận của đơn vị (hành động "attachment", băm của mã SHA-256 tệp).
-- Chạy lại nhiều lần không lỗi.

CREATE TABLE IF NOT EXISTS core_attachments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  module           text NOT NULL CHECK (module ~ '^[a-z][a-z0-9-]{0,62}$'),
  resource         text NOT NULL CHECK (resource ~ '^[a-z][a-z0-9_-]{0,62}$'),
  ref_id           text NOT NULL CHECK (length(ref_id) BETWEEN 1 AND 200),
  original_name    text NOT NULL CHECK (length(btrim(original_name)) BETWEEN 1 AND 180),
  mime_type        text NOT NULL CHECK (mime_type IN ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes       integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  sha256           text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  storage_key      text NOT NULL UNIQUE CHECK (storage_key ~ '^[0-9a-f-]{36}\.(pdf|png|jpg)$'),
  uploaded_by      text NOT NULL,
  uploaded_by_name text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS core_attachments_ref ON core_attachments (tenant_id, resource, ref_id);
REVOKE ALL ON core_attachments FROM PUBLIC;

-- Chỉ dịch vụ files, bằng token của người của đơn vị đã bật gói. Trả id đơn vị.
CREATE OR REPLACE FUNCTION public.attachment_caller(p_module text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Tệp đính kèm phải đi qua dịch vụ tệp của lõi (/files)' USING ERRCODE = '42501';
  END IF;
  PERFORM public.require_module(p_module);
  RETURN (SELECT id FROM tenants WHERE code = public.current_tenant_code());
END $$;
REVOKE ALL ON FUNCTION public.attachment_caller(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION api.attachment_register(module text, resource text, ref_id text, original_name text,
  mime_type text, size_bytes integer, sha256 text, storage_key text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid := public.attachment_caller(module);
  r core_attachments;
BEGIN
  INSERT INTO core_attachments (tenant_id, module, resource, ref_id, original_name, mime_type, size_bytes, sha256,
                                storage_key, uploaded_by, uploaded_by_name)
  VALUES (v_tenant, module, resource, ref_id, btrim(original_name), mime_type, size_bytes, sha256, storage_key,
          public.current_staff_id(), public.current_staff_name())
  RETURNING * INTO r;
  PERFORM public.ledger_record(v_tenant, ref_id, 'attachment', r.uploaded_by_name, r.sha256, r.created_at);
  RETURN json_build_object('id', r.id, 'resource', r.resource, 'ref_id', r.ref_id, 'original_name', r.original_name,
    'mime_type', r.mime_type, 'size_bytes', r.size_bytes, 'sha256', r.sha256, 'uploaded_by_name', r.uploaded_by_name,
    'created_at', r.created_at);
END $$;

CREATE OR REPLACE FUNCTION api.attachment_list(module text, resource text, ref_id text) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid := public.attachment_caller(module);
BEGIN
  RETURN (SELECT coalesce(json_agg(json_build_object('id', a.id, 'original_name', a.original_name,
            'mime_type', a.mime_type, 'size_bytes', a.size_bytes, 'sha256', a.sha256,
            'uploaded_by_name', a.uploaded_by_name, 'created_at', a.created_at) ORDER BY a.created_at), '[]'::json)
          FROM core_attachments a
          WHERE a.tenant_id = v_tenant AND a.module = attachment_list.module
            AND a.resource = attachment_list.resource AND a.ref_id = attachment_list.ref_id);
END $$;

-- Siêu dữ liệu một tệp của đơn vị người gọi. Dịch vụ files còn kiểm tra người gọi xem được đối tượng (ref_id).
CREATE OR REPLACE FUNCTION api.attachment_object(attachment_id uuid) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r core_attachments;
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Tệp đính kèm phải đi qua dịch vụ tệp của lõi (/files)' USING ERRCODE = '42501';
  END IF;
  SELECT a.* INTO r FROM core_attachments a JOIN tenants t ON t.id = a.tenant_id
   WHERE a.id = attachment_id AND t.code = public.current_tenant_code() AND t.status = 'active'
     AND public.tenant_has_module(t.id, a.module);
  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN json_build_object('id', r.id, 'module', r.module, 'resource', r.resource, 'ref_id', r.ref_id,
    'original_name', r.original_name, 'mime_type', r.mime_type, 'sha256', r.sha256, 'storage_key', r.storage_key);
END $$;

REVOKE ALL ON FUNCTION api.attachment_register(text, text, text, text, text, integer, text, text),
  api.attachment_list(text, text, text), api.attachment_object(uuid) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT EXECUTE ON FUNCTION api.attachment_register(text, text, text, text, text, integer, text, text),
      api.attachment_list(text, text, text), api.attachment_object(uuid) TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
