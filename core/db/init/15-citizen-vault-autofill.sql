-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Kho giấy tờ & dữ liệu tự điền, có thể áp dụng lại trên volume PostgreSQL hiện hữu.
-- Nội dung tệp luôn lưu ở object-store hiện tại; quyền sở hữu kiểm tra bằng FORCE RLS.

CREATE TABLE IF NOT EXISTS citizen_vault_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id uuid NOT NULL REFERENCES citizens(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  title text NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
  category text NOT NULL CHECK (category IN ('identity','residence','civil','business','land','other')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vault_owner_idx ON citizen_vault_documents(citizen_id, tenant_id, created_at DESC);
ALTER TABLE citizen_vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_vault_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vault_documents_owner ON citizen_vault_documents;
CREATE POLICY vault_documents_owner ON citizen_vault_documents FOR ALL
 USING (citizen_id = nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (citizen_id = nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

CREATE TABLE IF NOT EXISTS citizen_vault_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES citizen_vault_documents(id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no BETWEEN 1 AND 100),
  original_name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/png','image/jpeg')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  expires_on date,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no)
);
CREATE INDEX IF NOT EXISTS vault_versions_document_idx ON citizen_vault_versions(document_id, version_no DESC);
ALTER TABLE citizen_vault_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_vault_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vault_versions_owner ON citizen_vault_versions;
CREATE POLICY vault_versions_owner ON citizen_vault_versions FOR ALL
 USING (EXISTS (SELECT 1 FROM citizen_vault_documents d WHERE d.id=document_id))
 WITH CHECK (EXISTS (SELECT 1 FROM citizen_vault_documents d WHERE d.id=document_id));

-- Nhật ký chỉ ghi chia sẻ được công dân chấp thuận rõ ràng. Tệp đính kèm là bản sao,
-- nên lưu trữ/ngừng sử dụng bản gốc không tác động đến hồ sơ đã chia sẻ.
CREATE TABLE IF NOT EXISTS citizen_vault_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id uuid NOT NULL REFERENCES citizens(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  version_id uuid NOT NULL REFERENCES citizen_vault_versions(id),
  application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  attachment_id uuid REFERENCES application_documents(id) ON DELETE SET NULL,
  document_code text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vault_shares_owner_idx ON citizen_vault_shares(citizen_id, confirmed_at DESC);
ALTER TABLE citizen_vault_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_vault_shares FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vault_shares_owner ON citizen_vault_shares;
CREATE POLICY vault_shares_owner ON citizen_vault_shares FOR ALL
 USING (citizen_id = nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
 AND EXISTS (SELECT 1 FROM applications a WHERE a.id=application_id))
 WITH CHECK (citizen_id = nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid
 AND EXISTS (SELECT 1 FROM applications a WHERE a.id=application_id));

-- Trường tự khai được sửa bởi công dân. KHÔNG được đánh dấu đã xác minh.
CREATE TABLE IF NOT EXISTS citizen_self_facts (
  citizen_id uuid PRIMARY KEY REFERENCES citizens(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  birth_date date,
  citizen_identifier text CHECK (citizen_identifier IS NULL OR citizen_identifier ~ '^[0-9]{12}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE citizen_self_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_self_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_self_facts_owner ON citizen_self_facts;
CREATE POLICY citizen_self_facts_owner ON citizen_self_facts FOR ALL
 USING (citizen_id = nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (citizen_id = nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

-- Chỉ callback OIDC sau khi kiểm tra chữ ký, issuer, audience, nonce và opt-in
-- mới có đường ghi vào bảng này. Không có API công dân để đặt trạng thái verified.
CREATE TABLE IF NOT EXISTS citizen_verified_facts (
  citizen_id uuid NOT NULL REFERENCES citizens(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  field_key text NOT NULL CHECK (field_key IN ('fullName','birthDate','citizenIdentifier','phone','address')),
  field_value text NOT NULL CHECK (length(field_value) BETWEEN 1 AND 300),
  source_issuer text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(citizen_id, field_key)
);
ALTER TABLE citizen_verified_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_verified_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_verified_facts_owner ON citizen_verified_facts;
CREATE POLICY citizen_verified_facts_owner ON citizen_verified_facts FOR ALL
 USING (citizen_id = nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (citizen_id = nullif(current_setting('app.citizen_id',true),'')::uuid
 AND tenant_id = nullif(current_setting('app.tenant_id',true),'')::uuid);

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
  GRANT SELECT,INSERT ON citizen_vault_documents,citizen_vault_versions,citizen_vault_shares TO communeos_app;
  GRANT UPDATE(title,category,archived_at,updated_at) ON citizen_vault_documents TO communeos_app;
  GRANT UPDATE(expires_on) ON citizen_vault_versions TO communeos_app;
  GRANT SELECT,INSERT ON citizen_self_facts TO communeos_app;
  GRANT UPDATE(birth_date,citizen_identifier,updated_at) ON citizen_self_facts TO communeos_app;
  GRANT SELECT,INSERT ON citizen_verified_facts TO communeos_app;
  GRANT UPDATE(field_value,source_issuer,verified_at) ON citizen_verified_facts TO communeos_app;
 END IF;
END $$;
