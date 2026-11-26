-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Gói nghiệp vụ xã: API hồ sơ cho cán bộ (PostgREST đọc schema "api", đi sau cổng APISIX).
-- Cách ly xã nằm ở CƠ SỞ DỮ LIỆU (RLS), không chỉ ở giao diện:
--   token Keycloak có claim tenant_id = mã xã (vd "xa-a")
--   PostgREST ghi token vào request.jwt.claims
--   chính sách RLS chỉ trả về hồ sơ có tenants.code = tenant_id.
-- Chạy lại nhiều lần không lỗi.

-- Bảng đơn vị (tenants), hàm đọc token, che số điện thoại, API đơn vị thuộc lõi (core/db/init/02-don-vi.sql).

-- ===== 3. Chính sách RLS cho cán bộ (vai trò "commune-app") =====
-- Chỉ thấy hồ sơ của xã mình, và xã phải đang hoạt động (xã bị khóa → không thấy gì).
-- Chính sách của Kênh người dân (app.citizen_id) giữ nguyên.
DROP POLICY IF EXISTS staff_tenant_policy ON applications;
CREATE POLICY staff_tenant_policy ON applications FOR SELECT TO "commune-app"
  USING (tenant_id = (SELECT t.id FROM tenants t
                      WHERE t.code = public.current_tenant_code() AND t.status = 'active'));

DROP POLICY IF EXISTS staff_tenant_policy ON application_events;
CREATE POLICY staff_tenant_policy ON application_events FOR SELECT TO "commune-app"
  USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_id));

-- ===== 4. Schema api: những gì giao diện được thấy =====
CREATE SCHEMA IF NOT EXISTS api;

-- Hồ sơ của xã. security_invoker: chạy bằng quyền người gọi nên RLS luôn áp dụng.
DROP VIEW IF EXISTS api.dossiers;
CREATE VIEW api.dossiers WITH (security_invoker = true) AS
SELECT a.id, t.code AS tenant_code, a.procedure_id, p.title AS procedure_title,
       a.status, a.applicant_name,
       public.mask_phone(a.applicant_phone) AS applicant_phone,
       a.submitted_at, a.due_at,
       (a.due_at IS NOT NULL AND a.due_at < CURRENT_DATE
         AND a.status NOT IN ('completed', 'rejected')) AS overdue
FROM applications a
JOIN tenants t ON t.id = a.tenant_id
JOIN procedures p ON p.id = a.procedure_id
WHERE a.status <> 'draft';

DROP VIEW IF EXISTS api.dossier_events;
CREATE VIEW api.dossier_events WITH (security_invoker = true) AS
SELECT e.application_id AS dossier_id, e.event_type, e.note, e.actor_name, e.created_at
FROM application_events e;

DROP VIEW IF EXISTS api.procedures;
CREATE VIEW api.procedures WITH (security_invoker = true) AS
SELECT id, title, category, sla_days, fee_note FROM procedures WHERE published;

-- api.tenants (kèm số hồ sơ) do 08-api-can-bo.sql tạo lại trên bảng ảo của lõi.

-- ===== 6. Quyền =====
-- "commune-app" chỉ đọc các view trong api; không đọc được schema khác qua API.
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT USAGE ON SCHEMA api, public TO "commune-app";
    GRANT SELECT ON api.dossiers, api.dossier_events, api.procedures TO "commune-app";
    -- Bảng gốc cần SELECT vì view chạy bằng quyền người gọi; RLS vẫn lọc theo xã.
    GRANT SELECT ON applications, application_events, procedures TO "commune-app";
  END IF;
END $$;

-- Báo PostgREST nạp lại cấu trúc khi chạy lại script trên hệ thống đang chạy.
NOTIFY pgrst, 'reload schema';