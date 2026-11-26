-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Advisory rules: examples remain UNVERIFIED until an authorized editor records the source and review.
CREATE TABLE IF NOT EXISTS citizen_procedure_guidance_rules (
 id text PRIMARY KEY,
 procedure_id text NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
 purpose text NOT NULL,
 audiences text[] NOT NULL DEFAULT '{}'::text[],
 situations text[] NOT NULL DEFAULT '{}'::text[],
 explanation text NOT NULL,
 distinction text NOT NULL,
 source_reference text NOT NULL DEFAULT '',
 verified_at timestamptz,
 enabled boolean NOT NULL DEFAULT true,
 CHECK ((verified_at IS NULL) OR (length(trim(source_reference)) > 0))
);
-- These are UI discovery examples, NOT legal eligibility criteria or officially approved workflows.
-- On a fresh database the procedures catalog is populated later by db-setup/seed.sql.
-- Skip missing references on the first init; re-running this migration after seed fills them.
INSERT INTO citizen_procedure_guidance_rules
 (id,procedure_id,purpose,audiences,situations,explanation,distinction)
SELECT rule.id,rule.procedure_id,rule.purpose,rule.audiences,rule.situations,rule.explanation,rule.distinction
FROM (VALUES
 ('demo-birth','khai-sinh','birth',ARRAY['child','family'],ARRAY['first'],
  'Thủ tục có nội dung đăng ký khai sinh cho trẻ theo danh mục đang công bố.',
  'Đăng ký khai sinh khác với xác nhận thông tin cư trú; cơ quan có thẩm quyền quyết định điều kiện áp dụng.'),
 ('demo-marriage','ket-hon','marriage',ARRAY['self','family'],ARRAY['first'],
  'Thủ tục có nội dung đăng ký kết hôn theo danh mục đang công bố.',
  'Khác với chứng thực bản sao hoặc xác nhận cư trú.'),
 ('demo-residence','xac-nhan-cu-tru','residence',ARRAY['self','family'],ARRAY['proof','update'],
  'Thủ tục hiện có mô tả yêu cầu xác nhận thông tin cư trú.',
  'Xác nhận thông tin cư trú không đồng nghĩa với đăng ký hoặc thay đổi nơi cư trú.'),
 ('demo-business','ho-kinh-doanh','business',ARRAY['self','business'],ARRAY['first'],
  'Thủ tục hiện có về đăng ký thành lập hộ kinh doanh.',
  'Không thay cho thủ tục thay đổi hoặc chấm dứt đăng ký kinh doanh.'),
 ('demo-copy','chung-thuc','certification',ARRAY['self','family'],ARRAY['proof'],
  'Thủ tục chứng thực bản sao được công bố trong danh mục.',
  'Chứng thực bản sao khác chứng thực chữ ký và không xác minh toàn bộ nội dung giấy tờ.'),
 ('demo-land','dat-dai','land',ARRAY['self','family'],ARRAY['proof','update'],
  'Danh mục hiện có mục thông tin và hướng dẫn về đất đai.',
  'Mục hướng dẫn không đồng nghĩa có thể giải quyết mọi thủ tục đất đai trực tuyến.')
) AS rule(id,procedure_id,purpose,audiences,situations,explanation,distinction)
WHERE EXISTS (SELECT 1 FROM procedures p WHERE p.id = rule.procedure_id)
ON CONFLICT (id) DO NOTHING;

-- A preparation group is not a legally approved inter-agency service package.
CREATE TABLE IF NOT EXISTS citizen_service_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 citizen_id uuid NOT NULL REFERENCES citizens(id),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 120),
 purpose text NOT NULL DEFAULT '' CHECK(length(purpose)<=500),
 shared_data jsonb NOT NULL DEFAULT '{}'::jsonb,
 shared_consent boolean NOT NULL DEFAULT false,
 workflow_mode text NOT NULL DEFAULT 'preparation' CHECK(workflow_mode='preparation'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS citizen_service_batches_owner_idx
 ON citizen_service_batches(citizen_id,tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS citizen_service_batch_items (
 batch_id uuid NOT NULL REFERENCES citizen_service_batches(id) ON DELETE CASCADE,
 procedure_id text NOT NULL REFERENCES procedures(id),
 position smallint NOT NULL CHECK(position BETWEEN 1 AND 4),
 application_id text UNIQUE REFERENCES applications(id) ON DELETE SET NULL,
 PRIMARY KEY(batch_id,procedure_id), UNIQUE(batch_id,position)
);
ALTER TABLE citizen_service_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_service_batches FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_service_batches_owner ON citizen_service_batches;
CREATE POLICY citizen_service_batches_owner ON citizen_service_batches FOR ALL
 USING(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
   AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK(citizen_id=nullif(current_setting('app.citizen_id',true),'')::uuid
   AND tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid
   AND workflow_mode='preparation');
ALTER TABLE citizen_service_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_service_batch_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS citizen_service_batch_items_owner ON citizen_service_batch_items;
CREATE POLICY citizen_service_batch_items_owner ON citizen_service_batch_items FOR ALL
 USING(EXISTS(SELECT 1 FROM citizen_service_batches b WHERE b.id=batch_id))
 WITH CHECK(EXISTS(SELECT 1 FROM citizen_service_batches b WHERE b.id=batch_id)
   AND (application_id IS NULL OR EXISTS(
      SELECT 1 FROM applications a WHERE a.id=application_id AND a.procedure_id=procedure_id)));
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='communeos_app') THEN
  GRANT SELECT ON citizen_procedure_guidance_rules TO communeos_app;
  GRANT SELECT,INSERT ON citizen_service_batches TO communeos_app;
  GRANT SELECT,INSERT,UPDATE(application_id) ON citizen_service_batch_items TO communeos_app;
 END IF;
END $$;
