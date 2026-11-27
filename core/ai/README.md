<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/ai · Trí tuệ nhân tạo chạy cục bộ

Dịch vụ AI của lõi. Mô hình chạy trên máy chủ của xã, trong mạng Docker **không có đường ra Internet**.
CommuneOS không gọi bất kỳ API AI bên ngoài nào, vì hồ sơ hành chính và dữ liệu cá nhân là dữ liệu mật.

## Thành phần

| Dịch vụ compose | Phần mềm | Mạng | Việc |
| --- | --- | --- | --- |
| `ai-models` | Ollama 0.12.6 (`pull-models.sh`) | mạng chung | Chạy một lần mỗi khi `make up`: tải mô hình vào volume `ai-models` nếu chưa có. Dịch vụ AI duy nhất cần Internet, và chỉ ở lần đầu |
| `ai` | Ollama 0.12.6 | chỉ `ai-internal` (`internal: true`) | Chạy mô hình; không mở cổng, không ra được Internet |
| `ai-gateway` | Node.js 22, `server.mjs`, không thư viện ngoài | mạng chung và `ai-internal` | Cầu nối duy nhất tới mô hình, sau APISIX |
| `db` | PostgreSQL 17 + pgvector 0.8.1 | mạng chung | Kho tri thức dùng chung của lõi (`core/db/init/10-tri-thuc.sql`) và chỉ mục tri thức của gói xã (`modules/xa/db/22-ai-knowledge-vectors.sql`) |

Mô hình mặc định (đặt khác được trong `.env`):

| Biến | Mặc định | Giấy phép | Dùng để |
| --- | --- | --- | --- |
| `AI_CHAT_MODEL` | `qwen3:1.7b` (1,4 GB) | Apache-2.0 | Chọn câu trích dẫn trả lời câu hỏi |
| `AI_EMBED_MODEL` | `bge-m3` (1,2 GB) | MIT | Vector 1024 chiều cho tìm kiếm ngữ nghĩa, tốt với tiếng Việt |

Máy chủ có nhiều nhân hoặc có GPU có thể đặt `AI_CHAT_MODEL=qwen3:4b` hoặc `qwen3:8b`. Mô hình nhúng
phải cho vector 1024 chiều. Đo trên laptop Intel Core Ultra 5 225U (chỉ CPU): tìm kiếm dưới 1 giây,
chọn trích dẫn 3–15 giây với `qwen3:1.7b`.

## API (qua cổng APISIX)

| Đường dẫn | Ai gọi | Việc |
| --- | --- | --- |
| `POST /ai/ask` | Công dân (`citizen-app`), cán bộ (`commune-app`), cần token | `{ question, procedureId?, select? }` → kết quả tìm kiếm và trích dẫn |
| `POST /public/ai/ask` | Khách chưa đăng nhập | Như trên, không token; APISIX giới hạn 20 lần/phút, dịch vụ giới hạn 10 lần/phút mỗi IP |
| `GET /public/ai/ready` | Bất kỳ | `{ ready }`: đã có đủ mô hình chưa |
| `GET /ai/status` | Chỉ `sys_admin` | Mô hình đã tải, đã nạp, số đoạn đã có vector, thời gian phản hồi trung bình, lỗi gần nhất |

## Cách trả lời một câu hỏi (`/ai/ask`)

1. Che số điện thoại, dãy số dạng định danh, email trong câu hỏi trước khi đưa vào mô hình.
2. Tạo vector câu hỏi bằng mô hình nhúng.
3. Tìm kiếm lai song song trên mọi **nguồn tri thức** (không có dữ liệu cá nhân), toàn văn và vector, xếp hạng
   bằng Reciprocal Rank Fusion; gộp kết quả các nguồn theo điểm, lấy 8 đoạn tốt nhất. Kết quả vector chỉ được
   tính khi độ tương đồng cosine từ `AI_MIN_SIMILARITY` (mặc định 0,45) trở lên. Một nguồn lỗi thì vẫn dùng các
   nguồn còn lại.
4. Tách 3 đoạn đầu thành câu đánh số. Mô hình ngôn ngữ **chỉ trả số thứ tự câu**; trích dẫn được chép
   nguyên văn từ nguồn theo số đó, nên mô hình không thể tự viết nội dung.
5. Trả `{ mode, chunks, selections, masked, models, timings }`. Mô hình lỗi hoặc quá giờ thì vẫn trả
   kết quả tìm kiếm (`mode: semantic`).

Không lưu câu hỏi; nhật ký chỉ ghi mã băm, độ dài, số kết quả và thời gian.

### Nguồn tri thức

| Nguồn | Nội dung | Hàm |
| --- | --- | --- |
| Lõi (luôn có) | Kho tri thức dùng chung `core_knowledge`: tài liệu của các gói (mục `knowledge` của `module.json`, nạp khi cài gói) và tài liệu riêng do lãnh đạo đơn vị nạp (`POST /rest/rpc/knowledge_add`). Mỗi mục `## ...` của tài liệu Markdown là một đoạn | `api.core_knowledge_search`, `_pending`, `_store`, `_status` |
| Gói có `knowledgeProvider` trong `module.json` | Gói xã: thủ tục đã công bố (`citizen_knowledge_chunks`), câu hỏi thường gặp, hướng dẫn nghiệp vụ (`staff_guide`) | Gói xã: `api.knowledge_search`, `ai_pending_chunks`, `ai_store_embeddings`, `ai_index_status` |

Mọi hàm của nguồn tri thức có cùng chữ ký và cùng dạng kết quả, nên thêm nguồn chỉ cần khai báo, không sửa mã
của `ai-gateway`. Ví dụ gói doanh nghiệp mang quy chế nghỉ phép (`modules/doanh-nghiep/kb/quy-che-nghi-phep.md`):
nhân viên Công ty A hỏi "nghỉ ốm cần giấy tờ gì" thì trợ lý trích đúng mục quy chế đó.

Đơn vị xem tài liệu mình dùng được ở `GET /rest/knowledge_documents`; lãnh đạo nạp, gỡ tài liệu riêng bằng
`POST /rest/rpc/knowledge_add` (`module`, `title`, `content` Markdown, `audience`: `staff` hoặc `public`),
`POST /rest/rpc/knowledge_remove`.

### Phạm vi theo người hỏi (đặt từ token đã ký, người hỏi không tự khai được)

| Người hỏi | Thủ tục | Hướng dẫn nghiệp vụ cán bộ (`staff_guide`) |
| --- | --- | --- |
| Khách (`/public/ai/ask`) | Mọi thủ tục đã công bố | Không |
| Công dân (`citizen-app`) | Chỉ thủ tục xã của công dân đang mở (claim `citizen_tenant`) | Không |
| Cán bộ (`commune-app`) | Chỉ thủ tục xã của cán bộ đang mở (claim `tenant_id`) | Có |

Kho tri thức của lõi: chỉ tài liệu của các gói đơn vị người hỏi đã bật, tài liệu chung của gói và tài liệu riêng
của đơn vị đó; tài liệu `staff` chỉ cho người của đơn vị, khách và công dân chỉ thấy tài liệu `public`. Đơn vị không
bật gói xã thì không nhận tri thức nào của gói xã.

`api.knowledge_search` chỉ cấp cho vai trò `web_anon` mà `ai-gateway` dùng trong mạng nội bộ; gọi thẳng qua
`/rest` bằng token người dùng bị từ chối, nên không ai tự đổi được xã hay đối tượng. Hàm của kho tri thức lõi còn
đòi kèm `WORKFLOW_TOKEN`.

Câu hỏi tra cứu thông tin của một người cụ thể ("số điện thoại của công dân...", "hồ sơ của ông...") hoặc một
mã hồ sơ (`HS-...`) bị từ chối trước khi tìm kiếm (`mode: refused`). Trợ lý không có quyền đọc hồ sơ, giấy tờ,
thông báo hay bất kỳ dữ liệu cá nhân nào; việc tra cứu hồ sơ làm trên màn hình nghiệp vụ theo phân quyền.

Hướng dẫn nghiệp vụ cho cán bộ nằm trong bảng `staff_guide` (`modules/xa/db/24-staff-guide.sql`), tự đưa vào
chỉ mục tri thức khi thêm, sửa, xóa.

Trợ lý nổi ở góc màn hình có trên mọi trang của Kênh người dân (`AssistantWidget.vue`, gọi `/api/chat`) và
màn hình cán bộ (`StaffAssistant.vue`, gọi `/api/tro-ly`).

Kênh người dân (`apps/citizen/server/api/chat/index.post.ts`) dùng kết quả này như sau:
- tìm kiếm chỉ ra thủ tục nào được hỏi (chỉ dựa vào đoạn mang tính nhận diện như tên, nội dung,
  giấy tờ; không dựa vào đoạn lệ phí, thời hạn vốn giống nhau giữa các thủ tục);
- câu trả lời vẫn dựng từ dữ liệu thủ tục đã công bố;
- trích dẫn của mô hình chỉ được dùng khi thuộc đúng thủ tục, đúng loại thông tin được hỏi.

AI chưa sẵn sàng thì trợ lý dùng tìm kiếm toàn văn như trước.

## Chỉ mục vector

`ai-gateway` quét mỗi phút, tạo vector cho đoạn tri thức mới hoặc đã đổi nội dung (so mã băm MD5),
ghi qua hàm `pending`, `store` của từng nguồn (lõi: `api.core_knowledge_pending`, `api.core_knowledge_store`;
gói xã: `api.ai_pending_chunks`, `api.ai_store_embeddings`). Các hàm này chỉ nhận lời gọi kèm `WORKFLOW_TOKEN`
(cùng cách với dịch vụ điều phối). Đoạn không đổi nội dung giữ nguyên vector. `GET /ai/status` báo tình trạng chỉ
mục của từng nguồn.

Thủ tục có `ai_indexed = false` (danh mục mô phỏng của `make demo`, chưa có nội dung thật) không vào chỉ mục của
gói xã, để trợ lý không trích nội dung chưa xác minh.

## Máy chủ không có Internet

Tải mô hình trên một máy có mạng (`make up`), rồi chép volume sang máy chủ:

```bash
docker run --rm -v commune-os_ai-models:/m -v "$PWD":/out alpine tar czf /out/ai-models.tgz -C /m .
# trên máy chủ:
docker volume create commune-os_ai-models
docker run --rm -v commune-os_ai-models:/m -v "$PWD":/in alpine tar xzf /in/ai-models.tgz -C /m
```

Chưa có mô hình thì `ai-models` báo rồi vẫn thoát bình thường: lõi chạy đủ, trợ lý dùng tìm kiếm toàn văn.

## Kiểm thử

```bash
make test                       # có 4 kiểm tra AI khi dịch vụ AI đang chạy (không thì BỎ QUA)
make rag-test                   # trigger chỉ mục tri thức (ROLLBACK)
curl -s localhost:9080/public/ai/ready
curl -s -X POST -H 'content-type: application/json' \
  -d '{"question":"Em bé vừa chào đời cần làm giấy tờ gì"}' localhost:9080/public/ai/ask
docker compose logs ai-gateway  # mô hình đã nạp, số đoạn đã tạo vector
```

## Giới hạn

- Dữ liệu thủ tục mẫu là minh họa, chưa phải thông tin pháp lý chính thức.
- Mô hình nhỏ có thể không chọn được câu phù hợp; khi đó trợ lý dùng câu trả lời dựng từ dữ liệu.
- Câu hỏi có từ bỏ dấu trùng với tên thủ tục khác (ví dụ "đại học" và "đất đai") mà tìm kiếm ngữ nghĩa
  không chắc chắn thì vẫn có thể bị bộ xếp hạng từ khóa cũ chọn nhầm thủ tục.
- OCR giấy tờ chưa có; biến `CITIZEN_OCR_ENDPOINT` chỉ nhận dịch vụ trong mạng nội bộ.
