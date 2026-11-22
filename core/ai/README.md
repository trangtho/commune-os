<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# CommuneOS · AI thủ tục hành chính

Trợ lý AI là một **tính năng của Kênh công dân**, triển khai bằng Nuxt/Nitro tại
`apps/citizen/pages/tro-ly.vue` và `apps/citizen/server/api/chat/`.
Lõi hiện **chưa có dịch vụ AI** riêng; thư mục này chỉ chứa tài liệu.
Mặc định trợ lý chỉ dùng tìm kiếm toàn văn trên PostgreSQL, không dùng mô hình ngôn ngữ.

## Dòng dữ liệu

`procedures (published=true)` + `procedure_documents` + `citizen_faq`
→ trigger PostgreSQL → `citizen_knowledge_chunks` (GIN full-text,
`unaccent`, không chứa dữ liệu cá nhân) → API retrieval → kiểm tra nguồn
→ (tùy chọn) model chọn **đoạn trích nguyên văn** → kiểm chứng bằng code
→ trả lời và liên kết tới trang nội bộ.

Các trigger cập nhật chỉ mục **cùng giao dịch** với thay đổi nguồn: thêm,
sửa, xóa, unpublish thủ tục; thêm/sửa/xóa giấy tờ và FAQ. Thay đổi chưa
`COMMIT` không hiển thị. Dữ liệu thủ tục vẫn được lấy trực tiếp từ PostgreSQL
ở mỗi lượt hỏi để giới hạn khả năng index bị lỗi hoặc thiếu migration.

`core/db/init/02-ai-knowledge.sql` là migration thêm mới, được chạy bởi
`db-setup` sau khi seed; `make repair-db` tạo/chỉnh index trên volume cũ mà
không xóa hồ sơ. `make rag-test` kiểm thử trigger trong transaction và
`ROLLBACK` toàn bộ thay đổi thử nghiệm.

## Kết nối mô hình tùy chọn

Các biến **chỉ ở server**, truyền cho service `citizen` trong compose
(thông qua các override `NUXT_AI_*` tương ứng của Nuxt runtimeConfig):

```dotenv
CITIZEN_AI_ENDPOINT=http://<may-chu-noi-bo>/v1/chat/completions
CITIZEN_AI_MODEL=<ten-mo-hinh>
CITIZEN_AI_TOKEN=
```

Dữ liệu của hệ thống là dữ liệu mật: chỉ trỏ tới mô hình chạy trên máy chủ của đơn vị,
**không dùng API AI bên ngoài**. Mã hiện chấp nhận `https://` bất kỳ hoặc `http://localhost`,
`http://127.0.0.1`; chưa tự chặn địa chỉ ngoài mạng nội bộ. Biến chưa được khai báo trong
`.env.example`, chỉ có trong `docker-compose.yml`.

Endpoint phải tương thích OpenAI chat completions và hỗ trợ JSON output.
Không có provider/token/mô hình thì trợ lý vẫn hoạt động chế độ `DATA`,
không được mô tả là đã có AI tạo sinh. Khi có mô hình, API gửi tối đa
18 đoạn trích **đã lọc**, yêu cầu model chọn `id` và `quote` nguyên văn.
API bỏ toàn bộ nội dung không trùng nguồn, không nhận URL hay lời khẳng
định ngoài dữ liệu. Câu hỏi chứa số điện thoại, email, dãy định danh
không được chuyển tới mô hình. Lượt gọi có giới hạn thời gian 7 giây,
không redirect và không lưu hội thoại vào database.

Các biến `CITIZEN_RAG_ENDPOINT` / `CITIZEN_RAG_TOKEN` (classifier từ bản trước)
vẫn được hỗ trợ để giữ tương thích ngược, nhưng không bắt buộc.

## Giới hạn dữ liệu và nguyên tắc an toàn

- Seed 6 thủ tục là **dữ liệu minh họa**, chưa phải thông tin pháp lý chính thức.
- Dữ liệu hiện không có trường cơ quan tiếp nhận/điều kiện pháp lý xác thực,
  nên không đoán cơ quan, mức phí cụ thể, văn bản quy định hoặc quyền lợi.
- Chỉ bản ghi `published=true` được lập chỉ mục; bản ghi vừa gỡ công bố
  được xóa khỏi index ngay trong transaction.
- Không truy xuất `citizens`, `applications`, thông tin cá nhân, file tải lên.
- Link trích dẫn chỉ được tạo nội bộ: `/thu-tuc/<slug>` hoặc `/huong-dan`.
- PostgreSQL chỉ cấp **SELECT** chỉ mục cho tài khoản web, không cấp ghi.
- Khi dữ liệu nguồn không khả dụng hoặc không có bằng chứng, trả lời không đủ
  dữ liệu thay vì tự suy đoán.
- Kết quả chính thức trong tương lai cần metadata nguồn (mã văn bản,
  hiệu lực, cơ quan ban hành, địa phương) được nhóm dữ liệu kiểm chứng.
- Cần đánh giá bảo mật và hạn mức theo gateway trước khi triển khai cho công dân thật.

## Kiểm thử

```bash
npm --prefix apps/citizen test
make repair-db    # sao lưu DB trước nếu có dữ liệu cần giữ
make rag-test     # SQL test có ROLLBACK, không thay đổi dữ liệu
curl http://localhost:3000/api/chat/knowledge
```

`GET /api/chat/knowledge` trả thống kê chỉ mục, trạng thái bật mô hình,
không tiết lộ token. Ứng dụng có cảnh báo nếu chưa chạy migration.
