<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Kho giấy tờ cá nhân và gợi ý tự điền (Kênh công dân)

> Bản thử nghiệm trên CommuneOS. Không tải dữ liệu nhạy cảm/giấy tờ thật khi chạy với tài khoản demo.
> Đây không phải cơ chế xác minh nhân thân hay chứng thực giấy tờ.

## Các màn hình

1. **Hồ sơ cá nhân** (`/ho-so-ca-nhan`): bổ sung ngày sinh, số định danh **tự khai** và hiển thị nguồn của từng dữ liệu. Có liên kết tới kho giấy tờ.
2. **Kho giấy tờ số** (`/kho-giay-to`): thêm PDF/PNG/JPG <= 5 MB, đặt tên, phân loại, tìm kiếm, tải các phiên bản, cập nhật ngày hết hạn, chuyển sang lưu trữ/khôi phục và xem 100 lượt chia sẻ gần nhất.
3. **Nộp hồ sơ** (`/nop-ho-so/[slug]`): bước 1 chọn riêng từng gợi ý tự điền, xem nguồn, áp dụng thủ công rồi phải đánh dấu xác nhận đã rà soát; bước 2 dùng giấy tờ trong kho bằng cách chọn **phiên bản còn hiệu lực**, đánh dấu đồng ý chia sẻ **cho hồ sơ hiện tại** và bấm xác nhận. Bước 3 vẫn giữ xác nhận cuối cùng như `main`.

## API bổ sung

- `GET/POST /api/citizen/vault` — danh sách + tải tệp mới hoặc phiên bản mới (multipart gồm `file`, `title`, `category`, `expiresOn` hoặc `documentId`).
- `PATCH /api/citizen/vault/:id` — sửa tên, phân loại hoặc chuyển lưu trữ/khôi phục.
- `PATCH /api/citizen/vault/versions/:id` — cập nhật `expiresOn`.
- `GET /api/citizen/vault/files/:id` — đọc tệp riêng của tài khoản, có `?view=1` xem tại trình duyệt.
- `POST /api/applications/:id/documents/from-vault` — `{ "versionId": "uuid", "documentCode": "...", "confirmed": true }`.
- `GET /api/citizen/autofill?procedureId=...` — nguồn dữ liệu + danh sách trường có thể tự điền cho chính người thực hiện.
- `PATCH /api/citizen/autofill/self` — `{ "birthDate": "YYYY-MM-DD", "citizenIdentifier": "12 chữ số" }` hoặc chuỗi rỗng để bỏ. **Chỉ sửa dữ liệu tự khai**.

## Cơ sở dữ liệu, phạm vi bảo vệ

`core/db/init/15-citizen-vault-autofill.sql` tạo 5 bảng: `citizen_vault_documents`, `citizen_vault_versions`, `citizen_vault_shares`, `citizen_self_facts`, `citizen_verified_facts`. Áp dụng `FORCE RLS` theo `app.citizen_id` và `app.tenant_id` trong `citizenTx`. Tài khoản ứng dụng không được phép xóa nhật ký chia sẻ. Vật mang tệp vẫn nằm trong object store hiện tại, PostgreSQL chỉ giữ khóa đối tượng và SHA-256. Khi chia sẻ, backend kiểm tra quyền sở hữu, thời hạn và quyền sửa hồ sơ **hai lần** rồi sao chép tệp thành attachment của hồ sơ; không chuyển quyền truy cập kho gốc cho cán bộ. Giấy tờ hết hạn hay đã lưu trữ không được chia sẻ mới. Tệp đã được đính kèm vào hồ sơ sẽ tuân theo quyền và quy trình lưu trữ của hồ sơ đó; lưu trữ tài liệu gốc **không** thu hồi quyền xem tệp đính kèm đã gửi.

Không có thao tác xóa vĩnh viễn giấy tờ để tránh làm mất dấu vết chia sẻ; thao tác trên UI là **Lưu trữ** (có thể khôi phục). Nếu cần xóa vĩnh viễn theo chính sách bảo vệ dữ liệu, bổ sung quy trình retention, dọn object store và xử lý audit trước khi sử dụng thật.

## Xác minh và quy tắc ánh xạ

Dữ liệu từ `citizens` và `citizen_self_facts` được đánh nhãn **tự khai**, kể cả khi công dân đăng nhập bằng OIDC. Mặc định không có trường nào được nâng thành **đã xác minh**. Chỉ callback OIDC có quyền ghi bản ghi `citizen_verified_facts` **sau khi** kiểm tra chữ ký ID token, issuer/audience/nonce, bật cờ phê duyệt `CITIZEN_OIDC_PERSONAL_DATA_APPROVED=true`, cấu hình tên claim và công dân tích ô đồng ý lúc đăng nhập. Không dùng dữ liệu OIDC khác để suy luận mức xác thực. Mapping chỉ áp dụng các trường rõ ràng là **của người nộp cho bản thân**: chủ hộ kinh doanh, số định danh/điện thoại chủ hộ, người đề nghị xác nhận cư trú, địa chỉ cư trú, ngày sinh người nộp khi kết hôn. Không tự điền thông tin của cha/mẹ, vợ/chồng, chủ đất hoặc người được đại diện.

Biến cấu hình (đều là tên claim theo hợp đồng, không phải tên mặc định): `CITIZEN_OIDC_PERSONAL_DATA_APPROVED`, `CITIZEN_OIDC_PERSONAL_DATA_SCOPE`, `CITIZEN_OIDC_NAME_CLAIM`, `CITIZEN_OIDC_BIRTH_DATE_CLAIM`, `CITIZEN_OIDC_IDENTIFIER_CLAIM`, `CITIZEN_OIDC_PHONE_CLAIM`, `CITIZEN_OIDC_ADDRESS_CLAIM`. Các biến đã được đưa vào `.env.example` và `docker-compose.yml`; mặc định đều rỗng/tắt.

## Chạy và kiểm thử

Với Docker đang dùng (không xóa volume):

```bash
cp .env.example .env  # chỉ chạy khi chưa có .env; nếu đã có, GIỮ NGUYÊN và bổ sung biến mới
make repair-db        # chạy lại schema mới, không xóa dữ liệu
cd apps/citizen && npm ci && npm test && npm run typecheck && npm run build
cd ../.. && make vault-autofill-test
```

Kiểm thử Node tại `apps/citizen/tests/vault-autofill.test.mjs` bao gồm kiểm tra magic bytes, hạn sử dụng, ngăn điền trường người thân, bằng chứng bảo vệ RLS/consent/audit. SQL kiểm thử cách ly hai công dân tại `core/db/tests/citizen-vault-autofill.sql`, luôn `ROLLBACK`. Chưa thể khẳng định E2E đã qua nếu không có PostgreSQL/Object Store chạy thực tế. Trước khi triển khai thật: kết nối nguồn định danh có phê duyệt, đánh giá nhu cầu mã hóa dữ liệu định danh ở trạng thái lưu, hạn chế nhật ký PII, kiểm thử tích hợp với staff, malware scanning và chính sách lưu trữ/xóa dữ liệu.
