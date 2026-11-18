<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Bàn giao phần mở rộng Kênh công dân – Kho giấy tờ và tự điền

**Phiên bản nền**: `commune-os-feat-citizen-portal-integrated.zip` người dùng cung cấp ngày 16/11/2026.
**Phạm vi**: `apps/citizen/` và một migration mới `core/db/init/15-citizen-vault-autofill.sql`; chỉnh sửa nhỏ `docker-compose.yml`, `.env.example`, `Makefile`. Không đụng `apps/commune/`, `core/admin/`, không thay thế schema cũ, không commit/push/merge.

## Những phần đã bổ sung

- Trang `/kho-giay-to`: tải giấy tờ, phân nhóm, tìm kiếm, quản lý phiên bản và thời hạn, lưu trữ và khôi phục, theo dõi chia sẻ.
- 7 API kho giấy tờ, 2 API tự điền; cho phép gắn bản sao tệp từ kho vào `application_documents` sau sự đồng ý từng lần.
- Trang `/ho-so-ca-nhan`: dữ liệu ngày sinh/số định danh tự khai, xem nguồn/provenance.
- Trang `/nop-ho-so/[slug]`: gợi ý có nguồn, áp dụng thủ công, xác nhận rà soát; tải lại giấy tờ từ kho trong bước 2.
- OIDC tùy chọn nhập claim có kiểm tra token, với cờ phê duyệt và opt-in; mặc định TẮT.
- PostgreSQL FORCE RLS cho 5 bảng mới + nhật ký chia sẻ, 1 bộ test SQL cách ly công dân.
- 6 kiểm thử Node tự động và 2 bài test E2E Playwright mới.

## Cách chạy

1. Giải nén ZIP, sao lưu DB và `.env` trước khi thay đổi môi trường triển khai.
2. Nếu dự án đã có `.env`, không chép đè; chỉ bổ sung các biến mới nếu thực sự có nhà cung cấp OIDC được phê duyệt.
3. Với Docker hiện hữu: `make repair-db`. Migration được gọi **sau** `14-luu-tru-tep.sql`, có thể áp dụng lại. Với volume mới: `make up`.
4. `cd apps/citizen && npm ci && npm test && npm run typecheck && npm run build`.
5. Chạy `make vault-autofill-test` khi PostgreSQL đã sẵn sàng. Sau đó có thể chạy E2E `npm run test:e2e -- e2e/vault-autofill.spec.ts` trên demo stack.

## Kết quả và giới hạn kiểm thử tại thời điểm bàn giao

- **92/92** kiểm thử Node có sẵn và bổ sung đều đạt.
- `tsc --noEmit` kiểm tra kiểu cho các module dùng chung mới thành công.
- Đã phân tích cú pháp TypeScript các file chỉnh sửa có `script setup` và server API: không thấy lỗi cú pháp.
- **Chưa chạy được** `npm run build`, `npm run typecheck` Nuxt và Playwright do không thể tải hết dependencies từ `registry.npmjs.org` trong môi trường này.
- **Chưa chạy được** SQL integration test vì môi trường không có Docker/PostgreSQL. Không khẳng định tính năng đã được thử trên hệ thống chạy thực.
- Không sử dụng tệp/căn cước thật khi demo. OCR, xác minh pháp lý, ký số, mã hóa lưu trữ ở trạng thái nghỉ, chính sách xóa vĩnh viễn và liên thông VNeID thật không nằm trong phạm vi lần triển khai này.

Tài liệu chi tiết: `apps/citizen/docs/VAULT_AND_AUTOFILL.md`.
