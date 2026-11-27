-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Mô tả tiếng Việt cho schema api và các API thuộc lõi. PostgREST đưa vào tài liệu OpenAPI tự sinh (GET /rest/),
-- trang tài liệu API (/docs/) hiển thị lại. Mỗi gói nghiệp vụ tự mô tả API của mình.
-- Tệp 9x của lõi chạy SAU mọi gói (core/db/migrate.sh), vì gói có thể tạo lại bảng ảo của lõi (ví dụ api.tenants).
-- Chạy lại nhiều lần được; hàm, bảng ảo chưa có thì bỏ qua.

COMMENT ON SCHEMA api IS $$CommuneOS – API dữ liệu của lõi và các gói nghiệp vụ

API tự sinh bởi PostgREST trên schema `api` của PostgreSQL, gọi qua cổng APISIX tại `/rest/`.
Mọi lời gọi cần token Keycloak (`Authorization: Bearer <token>`); token của client `commune-app` dùng cho người của
đơn vị (cán bộ, lãnh đạo) và quản trị hệ thống; gói nghiệp vụ xã dùng thêm client `citizen-app` cho công dân.
Row Level Security tự lọc theo đơn vị (xã, công ty...) trong token, nên cùng một đường dẫn mỗi người thấy dữ liệu khác nhau.

Bảng ảo: `GET /rest/<tên>` với bộ lọc PostgREST, ví dụ `?status=eq.processing&order=submitted_at.desc&limit=20`.
Hàm: `POST /rest/rpc/<tên>` với thân JSON gồm các tham số.
Khách chưa đăng nhập chỉ gọi được các hàm được mở riêng qua `/public/rpc/`.

Trang này liệt kê mọi phương thức PostgREST hỗ trợ cho mỗi bảng ảo; quyền thật do vai trò trong token quyết định.
Bảng ảo chỉ cho đọc (GET); mọi thao tác ghi đi qua hàm `rpc/*`, nơi lõi và gói kiểm tra đơn vị, vai trò và dữ liệu.$$;

DO $$
DECLARE
  item record;
  fn oid;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('tenants', 'Danh sách đơn vị',
     'Quản trị hệ thống thấy mọi đơn vị; người của đơn vị chỉ thấy đơn vị mình. Cột status: active (đang hoạt động) hoặc locked (đã khóa). Gói nghiệp vụ có thể thêm cột thống kê riêng ở cuối.'),
    ('add_tenant', 'Thêm đơn vị mới', 'Chỉ sys_admin. Bảng quản trị tạo đơn vị kèm lãnh đạo qua POST /accounts/tenants.'),
    ('remove_new_tenant', 'Hủy đơn vị vừa tạo khi tạo tài khoản lãnh đạo lỗi', 'Chỉ sys_admin; chỉ đơn vị tạo trong vòng 1 giờ, chưa có dữ liệu.'),
    ('set_tenant_status', 'Khóa hoặc mở một đơn vị', 'status: active hoặc locked. Chỉ sys_admin.'),
    ('ledger', 'Sổ ghi nhận chống sửa',
     'Mỗi thao tác (trên hồ sơ, đơn...) nối với thao tác trước của cùng đơn vị bằng mã băm. Cột dossier_id là mã đối tượng. Kiểm tra toàn chuỗi bằng rpc/verify_ledger.'),
    ('verify_ledger', 'Kiểm tra toàn vẹn sổ ghi nhận',
     'Tính lại từng mã băm và so với sổ. Thân {} kiểm tra mọi đơn vị, hoặc {"only_tenant":"xa-a"}. broken_seq: vị trí đầu tiên bị sửa.'),
    ('staff_audit', 'Nhật ký quản lý tài khoản cán bộ', 'Tạo, khóa, mở, cấp lại mật khẩu, sửa, xóa; không chứa mật khẩu.'),
    ('log_staff_action', 'Ghi nhật ký quản lý tài khoản (chỉ dịch vụ tài khoản gọi)', 'Cần khóa nội bộ X-Workflow-Token.'),
    ('modules', 'Gói nghiệp vụ đã cài trên lõi', 'Tên, phiên bản, thời điểm cài và cập nhật (modules/<tên>/module.json).'),
    ('public_platform', 'Thông tin nền tảng: các gói nghiệp vụ đã cài (công khai)', 'Gọi qua /public/rpc/public_platform; cổng API dùng để kiểm tra sức khỏe.'),
    ('tenant_modules', 'Gói nghiệp vụ bật cho từng đơn vị', 'Quản trị hệ thống thấy mọi đơn vị; người của đơn vị chỉ thấy đơn vị mình. Gói chỉ phục vụ đơn vị đã bật nó.'),
    ('my_modules', 'Gói nghiệp vụ của đơn vị người gọi', 'Ví dụ ["xa"]. Ứng dụng của một gói dùng để từ chối người của đơn vị không dùng gói đó.'),
    ('set_tenant_module', 'Bật hoặc tắt một gói cho một đơn vị', 'Chỉ sys_admin; chỉ bật được gói đang được cài. Tắt gói không xóa dữ liệu của gói.'),
    ('attachment_register', 'Ghi tệp đính kèm của một đối tượng (chỉ dịch vụ tệp của lõi gọi, cần X-Workflow-Token)', 'Ứng dụng tải tệp lên qua POST /files/<loại>/<mã>/attachments. Mỗi tệp ghi một dòng vào sổ ghi nhận.'),
    ('attachment_list', 'Danh sách tệp đính kèm của một đối tượng (chỉ dịch vụ tệp của lõi gọi)', 'Ứng dụng gọi GET /files/<loại>/<mã>/attachments.'),
    ('attachment_object', 'Siêu dữ liệu một tệp đính kèm (chỉ dịch vụ tệp của lõi gọi)', 'Ứng dụng tải tệp qua GET /files/attachments/<id>.'),
    ('knowledge_documents', 'Tài liệu trong kho tri thức của trợ lý AI mà đơn vị dùng được', 'scope: goi (tài liệu chung của gói đơn vị đã bật) hoặc don-vi (tài liệu riêng của đơn vị). Mỗi dòng là một mục "## ..." của tài liệu.'),
    ('knowledge_add', 'Lãnh đạo nạp tài liệu riêng của đơn vị vào kho tri thức', 'module: gói đơn vị đã bật; content: Markdown, mỗi "## ..." là một mục; audience: staff (mặc định) hoặc public.'),
    ('knowledge_remove', 'Lãnh đạo gỡ một tài liệu riêng của đơn vị', 'document: mã tài liệu trả về từ knowledge_add. Không gỡ được tài liệu chung của gói.'),
    ('core_knowledge_search', 'Tìm kiếm lai toàn văn và ngữ nghĩa trên kho tri thức của lõi (chỉ ai-gateway gọi, cần X-Workflow-Token)', 'Ứng dụng hỏi trợ lý qua POST /ai/ask.'),
    ('core_knowledge_pending', 'Đoạn tri thức của lõi chưa có vector (chỉ ai-gateway gọi)', NULL),
    ('core_knowledge_store', 'Lưu vector cho đoạn tri thức của lõi (chỉ ai-gateway gọi)', NULL),
    ('core_knowledge_status', 'Tình trạng chỉ mục vector của kho tri thức lõi (chỉ ai-gateway gọi)', NULL),
    ('module_roles', 'Vai trò do gói nghiệp vụ khai báo, gán được cho nhân viên', 'role: tên trong Keycloak và trong token ("<gói>:<vai trò>"). Người của đơn vị chỉ thấy vai trò của gói đơn vị đã bật. Lãnh đạo gán bằng PUT /accounts/staff/<id>/roles.')
  ) AS t(name, summary, detail)
  LOOP
    IF to_regclass('api.' || quote_ident(item.name)) IS NOT NULL THEN
      EXECUTE format('COMMENT ON %s api.%I IS %L',
        CASE (SELECT relkind FROM pg_class WHERE oid = to_regclass('api.' || quote_ident(item.name)))
          WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,
        item.name, concat_ws(E'\n\n', item.summary, item.detail));
    END IF;
    FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'api' AND p.proname = item.name LOOP
      EXECUTE format('COMMENT ON FUNCTION %s IS %L', fn::regprocedure, concat_ws(E'\n\n', item.summary, item.detail));
    END LOOP;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
