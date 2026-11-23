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
| `db` | PostgreSQL 17 + pgvector 0.8.1 | mạng chung | Vector của chỉ mục tri thức (`core/db/init/22-ai-knowledge-vectors.sql`) |

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
3. Tìm kiếm lai trên `citizen_knowledge_chunks` (chỉ thủ tục đã công bố và câu hỏi thường gặp, không có
   dữ liệu cá nhân): toàn văn và vector, xếp hạng bằng Reciprocal Rank Fusion (`api.knowledge_search`).
   Kết quả vector chỉ được tính khi độ tương đồng cosine từ `AI_MIN_SIMILARITY` (mặc định 0,45) trở lên.
4. Tách 3 đoạn đầu thành câu đánh số. Mô hình ngôn ngữ **chỉ trả số thứ tự câu**; trích dẫn được chép
   nguyên văn từ nguồn theo số đó, nên mô hình không thể tự viết nội dung.
5. Trả `{ mode, chunks, selections, masked, models, timings }`. Mô hình lỗi hoặc quá giờ thì vẫn trả
   kết quả tìm kiếm (`mode: semantic`).

Không lưu câu hỏi; nhật ký chỉ ghi mã băm, độ dài, số kết quả và thời gian.

### Phạm vi theo người hỏi (đặt từ token đã ký, người hỏi không tự khai được)

| Người hỏi | Thủ tục | Hướng dẫn nghiệp vụ cán bộ (`staff_guide`) |
| --- | --- | --- |
| Khách (`/public/ai/ask`) | Mọi thủ tục đã công bố | Không |
| Công dân (`citizen-app`) | Chỉ thủ tục xã của công dân đang mở (claim `citizen_tenant`) | Không |
| Cán bộ (`commune-app`) | Chỉ thủ tục xã của cán bộ đang mở (claim `tenant_id`) | Có |

`api.knowledge_search` chỉ cấp cho vai trò `web_anon` mà `ai-gateway` dùng trong mạng nội bộ; gọi thẳng qua
`/rest` bằng token người dùng bị từ chối, nên không ai tự đổi được xã hay đối tượng.

Câu hỏi tra cứu thông tin của một người cụ thể ("số điện thoại của công dân...", "hồ sơ của ông...") hoặc một
mã hồ sơ (`HS-...`) bị từ chối trước khi tìm kiếm (`mode: refused`). Trợ lý không có quyền đọc hồ sơ, giấy tờ,
thông báo hay bất kỳ dữ liệu cá nhân nào; việc tra cứu hồ sơ làm trên màn hình nghiệp vụ theo phân quyền.

Hướng dẫn nghiệp vụ cho cán bộ nằm trong bảng `staff_guide` (`core/db/init/24-staff-guide.sql`), tự đưa vào
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
ghi qua `api.ai_pending_chunks` và `api.ai_store_embeddings`. Hai hàm này chỉ nhận lời gọi kèm
`WORKFLOW_TOKEN` (cùng cách với dịch vụ điều phối). Trigger của `02-ai-knowledge.sql` cập nhật chỉ mục
tại chỗ, nên đoạn không đổi giữ nguyên vector.

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
