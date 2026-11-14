# CommuneOS · AI thủ tục hành chính

Trợ lý AI là một **tính năng của Kênh công dân**, triển khai bằng Nuxt/Nitro tại
`apps/citizen/pages/tro-ly.vue` và `apps/citizen/server/api/chat/`.
Không khởi chạy một dịch vụ AI riêng không có trong kiến trúc main; khi nhóm có
AI service chung có thể tích hợp qua biến môi trường server.

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
CITIZEN_AI_ENDPOINT=https://your-trusted-provider.example/v1/chat/completions
CITIZEN_AI_MODEL=your-approved-model
CITIZEN_AI_TOKEN=your-private-token
```

Endpoint phải tương thích OpenAI chat completions và hỗ trợ JSON output.
Không có provider/token/mô hình thì trợ lý vẫn hoạt động chế độ `DATA`,
không được mô tả là đã có AI tạo sinh. Khi có mô hình, API gửi tối đa
18 đoạn trích **đã lọc**, yêu cầu model chọn `id` và `quote` nguyên văn.
API bỏ toàn bộ nội dung không trùng nguồn, không nhận URL hay lời khẳng
định ngoài dữ liệu. Câu hỏi chứa số điện thoại, email, dãy định danh
không được chuyển tới model ngoài. Lượt gọi có giới hạn thời gian 7 giây,
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
- Cần đánh giá bảo mật, hạn mức theo gateway và xác nhận nhà cung cấp AI
  trước khi triển khai cho công dân thật.

## Kiểm thử

```bash
npm --prefix apps/citizen test
make repair-db    # trên máy Mac có Docker, sao lưu DB nếu cần
make rag-test     # SQL test có ROLLBACK, không thay đổi dữ liệu
curl http://localhost:3000/api/chat/knowledge
```

`GET /api/chat/knowledge` trả thống kê chỉ mục, trạng thái bật mô hình,
không tiết lộ token. Ứng dụng có cảnh báo nếu chưa chạy migration.
