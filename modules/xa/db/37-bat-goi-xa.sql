-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Gói xã chỉ phục vụ đơn vị đã bật gói "xa" (core/db/init/08-goi-theo-don-vi.sql).
-- Nâng cấp bản cài đã có dữ liệu: bật gói xã cho các đơn vị đang dùng (đã mở thủ tục, có hồ sơ hoặc công dân).
-- Chỉ chạy một lần (khi chưa đơn vị nào bật gói xã), để không bật lại cho đơn vị mà quản trị đã tắt.
-- Đơn vị tạo mới: quản trị chọn gói khi tạo (POST /accounts/tenants, "modules") hoặc bật ở bảng quản trị.

INSERT INTO tenant_modules (tenant_id, module)
SELECT t.id, 'xa' FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM tenant_modules WHERE module = 'xa')
  AND (EXISTS (SELECT 1 FROM tenant_procedures tp WHERE tp.tenant_id = t.id)
       OR EXISTS (SELECT 1 FROM applications a WHERE a.tenant_id = t.id OR a.receiving_tenant_id = t.id)
       OR EXISTS (SELECT 1 FROM citizens c WHERE c.tenant_id = t.id))
ON CONFLICT DO NOTHING;
