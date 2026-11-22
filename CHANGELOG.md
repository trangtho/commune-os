<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Lịch sử thay đổi

Mọi thay đổi đáng chú ý của dự án được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
đánh số phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Sửa lỗi (thông báo cho cán bộ, 2026-11-22)

- Trang thông báo của cán bộ luôn trống vì đọc nhầm bảng thông báo của công dân (RLS chặn). Thay bằng thông báo riêng cho
  cán bộ (`core/db/init/23-staff-notifications.sql`), lõi tự sinh khi có hồ sơ mới, hồ sơ được giao, hồ sơ đã bổ sung,
  cán bộ gửi yêu cầu, lãnh đạo duyệt hoặc từ chối; đọc qua `/rest/staff_notifications`, trạng thái đã đọc riêng từng cán bộ.
- "Gửi thông báo chung" chèn thông báo không có người nhận và ai cũng gửi được: nay chỉ lãnh đạo xã gửi, tới từng công dân của xã.
- "Đọc tất cả" không đánh dấu gì; nay đánh dấu đã đọc thật.
- `make test` thêm 2 kiểm tra, tổng 45 (#73).

### Thêm mới (sao lưu và khôi phục, 2026-11-22)

- `make backup`: sao lưu ba cơ sở dữ liệu (`pg_dump`), kho đối tượng SeaweedFS và tệp cũ của Kênh người dân vào
  `backups/<ngày-giờ>/`, kèm `MANIFEST.txt` và `SHA256SUMS`; `backups/` có trong `.gitignore`.
- `make restore BACKUP=...`: kiểm tra mã băm, bắt xác nhận, khôi phục, chạy lại `db-setup` cho khớp lược đồ mới nhất.
- Hướng dẫn và kết quả diễn tập khôi phục trên máy chủ mới: `core/backup/README.md` (#72).

### Thêm mới (trang Tình trạng hệ thống, 2026-11-22)

- Bảng quản trị: trang `/tinh-trang` kiểm tra từng dịch vụ lõi qua cổng API (định danh, cổng API và dữ liệu, quy trình,
  lưu trữ tệp, tài khoản cán bộ, AI, sổ ghi nhận), kèm thời gian phản hồi, tự kiểm tra lại mỗi 30 giây; chỉ đọc.
- `/workflow/health`, `/files/health`, `/accounts/health` kiểm tra cả thành phần phía sau (Flowable, SeaweedFS, Keycloak Admin API)
  và trả 503 khi thành phần đó không trả lời.
- `make test` thêm 1 kiểm tra, tổng 43.

### Thêm mới (AI chạy cục bộ trong lõi, 2026-11-22)

- Dịch vụ AI của lõi, mô hình chạy trên máy chủ, không gọi API AI bên ngoài: `ai` (Ollama 0.12.6) chỉ nằm trong mạng
  `ai-internal` không ra được Internet; `ai-models` tự tải mô hình ở lần `make up` đầu tiên; `ai-gateway`
  (`core/ai/server.mjs`) sau APISIX tại `/ai/*` (cần token) và `/public/ai/*` (khách, giới hạn số lần gọi).
- Mô hình mặc định `qwen3:1.7b` (Apache-2.0) và `bge-m3` (MIT), đổi được qua `AI_CHAT_MODEL`, `AI_EMBED_MODEL`.
- Tìm kiếm lai toàn văn + vector (pgvector 0.8.1, `core/db/init/22-ai-knowledge-vectors.sql`); `ai-gateway` tự tạo vector
  cho đoạn tri thức mới hoặc đã sửa.
- Mô hình chỉ trả số thứ tự câu, trích dẫn chép nguyên văn từ nguồn; che số điện thoại, số định danh, email trước khi
  đưa vào mô hình; không lưu câu hỏi.
- Trợ lý `/tro-ly` dùng AI của lõi: câu hỏi diễn đạt khác từ ngữ trong thủ tục vẫn tìm đúng thủ tục; AI chưa sẵn sàng thì
  dùng tìm kiếm toàn văn. `GET /ai/status` cho quản trị hệ thống.
- `make test` thêm 4 kiểm tra AI (bỏ qua khi AI không chạy), tổng 42 (#68).

### Thay đổi (AI chạy cục bộ trong lõi, 2026-11-22)

- Ảnh `db` chuyển sang `pgvector/pgvector:0.8.1-pg17-trixie` (cùng PostgreSQL 17 và glibc với ảnh cũ, giữ nguyên dữ liệu).
- Bỏ cấu hình gọi mô hình bên ngoài `CITIZEN_AI_*`, `CITIZEN_RAG_*` và hai tệp `ai-classifier.ts`, `rag-answer.ts`;
  OCR chỉ nhận dịch vụ trong mạng nội bộ.
- Chỉ mục tri thức cập nhật tại chỗ thay cho xóa rồi chèn lại, giữ vector của đoạn không đổi.
- `make up` tạo lại container `gateway` để luôn nạp cấu hình cổng mới nhất sau khi `git pull`.

### Thay đổi (Kênh người dân gọi lõi qua cổng API, 2026-11-22)

- Luồng chính của Kênh người dân không còn truy vấn PostgreSQL trực tiếp: danh mục và chi tiết thủ tục, tạo, sửa,
  tự lưu bản nháp, nộp hồ sơ, đính kèm, tải và xóa giấy tờ, hồ sơ của tôi, thông báo, hồ sơ cá nhân gọi các hàm `api.*`
  của lõi qua cổng `/rest` (`core/db/init/21-citizen-api-core-flow.sql`).
- Lõi kiểm tra lại mọi ràng buộc trong cùng giao dịch khi ghi: trạng thái bản nháp, khóa thủ tục, phiên bản đã xác nhận,
  xã còn mở thủ tục, tuyến tiếp nhận, người kê khai hoặc quyền đại diện, đủ giấy tờ bắt buộc (Poka-yoke), bản nháp chưa đổi
  kể từ lúc kiểm tra biểu mẫu.
- Khách chưa đăng nhập xem danh mục thủ tục qua tuyến công khai `/public/rpc/*` (PostgREST vai trò `web_anon`, giới hạn số lần gọi).
- Client `citizen-app` chuyển thành client bí mật (biến mới `CITIZEN_KEYCLOAK_SECRET`): chỉ máy chủ Kênh người dân xin được
  token công dân; `identity-setup` tự chuyển trên realm đã có.
- `make test` thêm 5 kiểm tra (tổng 38); thêm `make citizen-api-test` (tạo, nộp hồ sơ, Poka-yoke, ROLLBACK) (#66).

### Sửa lỗi (Kênh người dân gọi lõi qua cổng API, 2026-11-22)

- Xóa giấy tờ của bản nháp báo lỗi do vai trò ứng dụng không có quyền xóa (#66).

### Sửa lỗi (nộp hồ sơ, 2026-11-22)

- Nộp hồ sơ và xác nhận phiên bản thủ tục mới ở Kênh người dân báo "Server Error" (`permission denied for table procedures`):
  khóa dòng thủ tục chuyển sang hàm `public.lock_procedure_shared`, không cấp thêm quyền sửa bảng `procedures` (#64).

### Thêm mới (đăng nhập công dân bằng Keycloak, 2026-11-22)

- Công dân đăng nhập bằng Keycloak: vai trò `citizen`, client `citizen-app`, thuộc tính `citizen_id`, `citizen_tenant`
  (chỉ quản trị xem và sửa); tài khoản mẫu `congdan.demo`, `congdan.khac` có trong tệp realm.
- Dịch vụ `identity-setup` bổ sung vai trò, client, người dùng mới của tệp realm vào realm đã có, không ghi đè.
- PostgREST nhận token công dân: vai trò `citizen-app`, hàm `rest_pre_request` đặt biến RLS từ token;
  API đầu tiên cho công dân `GET /rest/my_citizen_profile` (`core/db/init/19-citizen-rest-api.sql`).
- Kênh người dân: đăng nhập qua Keycloak, đọc hồ sơ công dân qua cổng `/rest`; token giữ trong cookie HttpOnly mã hóa,
  tự gia hạn; đăng xuất thu hồi phiên Keycloak; đổi mật khẩu qua `POST /accounts/me/password` của lõi.
- `make test` thêm 5 kiểm tra cho công dân, tổng 33 (#64).

### Thay đổi (đăng nhập công dân bằng Keycloak, 2026-11-22)

- Mật khẩu công dân lưu ở Keycloak; cột `citizens.password_hash` không còn dùng để đăng nhập.

### Sửa lỗi (vận hành, 2026-11-22)

- `identity` (Keycloak) và `gateway` (APISIX) tự khởi động lại sau khi máy chủ khởi động lại (`restart: unless-stopped`).
- Màn hình cán bộ xã kết nối được PostgreSQL khi chạy bằng Docker (thiếu biến `NUXT_DB_*`), chờ `db-setup` xong mới chạy.

### Tài liệu (rà soát hướng dẫn, 2026-11-22)

- Sửa tài liệu cho khớp mã nguồn: `README.md`, `docs/CITIZEN_SETUP.md`, `docs/README.md`, `core/ai`, `core/db`,
  `core/gateway`, `core/rest`, `core/tests`, `packs`, `apps/admin`, `apps/commune`, `DEPENDENCIES.md`.
- Nêu rõ Kênh người dân còn nối PostgreSQL trực tiếp, lõi chưa có dịch vụ AI và mô hình AI chỉ được chạy trên máy chủ nội bộ;
  bỏ các mô tả "chưa có APISIX, Flowable, ClamAV" đã cũ; số kiểm tra của `make test` là 28.

### Thêm mới (hồ sơ cá nhân và điều hành cán bộ, 2026-11-19)

- Hồ sơ cá nhân cho mọi cán bộ (`/ho-so-ca-nhan`): thông tin, giấy tờ, yêu cầu, việc được giao.
  Mọi thay đổi do cán bộ đề nghị chỉ áp dụng khi lãnh đạo duyệt.
- Khu Nhân viên cho lãnh đạo: hồ sơ nhân viên, hàng chờ duyệt, giao việc, giám sát khối lượng công việc.
- Phân công hồ sơ của dân cho cán bộ; hai cấp duyệt: cán bộ xử lý phải trình lãnh đạo trước khi trả kết quả,
  được ép bằng trigger trong cơ sở dữ liệu.
- Dịch vụ tệp thêm `/files/staff-documents` (giấy tờ cá nhân, có SHA-256).
- `core/db/init/17-nhan-vien.sql`; tài liệu `docs/QUAN_LY_NHAN_VIEN.md`; `make test` thêm 3 kiểm tra (#58).

### Thêm mới (quản lý cán bộ xã, 2026-11-16)

- Mỗi xã có hai vai trò: `leader` (lãnh đạo) và `officer` (cán bộ xử lý); thêm tài khoản thử `lanhdao.xa-a`, `lanhdao.xa-b`.
- Dịch vụ tài khoản của lõi `core/accounts` sau cổng `/accounts/*`: lãnh đạo tạo, sửa, khóa, mở, cấp lại mật khẩu, xóa
  cho cán bộ xử lý cùng xã qua Keycloak Admin API; xã và vai trò do lõi tự gán.
- Nhật ký `staff_audit` (chỉ thêm), xem qua `GET /rest/staff_audit`.
- Màn hình cán bộ: trang Nhân viên dùng dữ liệu thật, chỉ hiện với lãnh đạo.
- Cán bộ đổi mật khẩu tạm ngay trên trang đăng nhập (`POST /accounts/first-password`, không cần token, giới hạn số lần thử).
- Biến mới `KEYCLOAK_ACCOUNTS_SECRET`; `make test` thêm 4 kiểm tra (#57).

### Bảo mật (quản lý cán bộ xã, 2026-11-16)

- Người dùng không còn tự sửa được `tenant_id` ở trang tài khoản Keycloak (trước đây có thể tự chuyển sang xã khác).
- Bỏ bảng `staff` và dữ liệu giả ở `apps/commune`; tài khoản cán bộ chỉ nằm ở Keycloak.

### Thay đổi (lõi không giao diện, 2026-11-16)

- Chuyển bảng quản trị hệ thống từ `core/admin` sang `apps/admin`: thư mục `core/` chỉ còn dịch vụ và API.
- Đăng nhập bảng quản trị nhận mã xác thực hai lớp (OTP) khi tài khoản đã bật trong Keycloak;
  báo rõ khi tài khoản bị khóa hoặc chưa hoàn tất cài đặt.
- `DEPENDENCIES.md` liệt kê đủ thư viện của `apps/admin`, `apps/citizen`, `apps/commune`
  và nêu rõ kho mã không đi kèm mô hình AI (#52).

### Thêm mới (thủ tục theo xã, 2026-11-16)

- Thủ tục theo xã: danh mục thủ tục dùng chung, mỗi xã chỉ nhận hồ sơ cho thủ tục quản trị đã mở cho xã đó
  (bảng `tenant_procedures`); cơ sở dữ liệu tự chặn hồ sơ nộp vào xã chưa mở thủ tục.
- Nạp gói thủ tục từ `pack.yaml` (`api.import_procedure`), kiểm tra mã, tên, phiên bản; thêm gói mẫu `packs/dang-ky-tam-vang`.
- API lõi `api.set_tenant_procedure`, `api.set_tenant_procedures`, `api.set_procedure_tenants` (chỉ `sys_admin`);
  `GET /rest/procedures` với cán bộ chỉ trả thủ tục xã mình đang mở.
- Bảng quản trị lấy xã làm trung tâm: danh sách xã có tìm kiếm và số thủ tục đang mở; trang chi tiết xã
  (tổng quan, sổ ghi nhận, mở/tắt thủ tục theo lĩnh vực, mở/tắt hàng loạt); danh mục thủ tục và trang chi tiết thủ tục.
- Kênh người dân chỉ hiện thủ tục xã mình đang mở; mở thủ tục xã chưa mở thì báo ngay, không hiện biểu mẫu.
- `make test` thêm 2 kiểm tra.

### Thay đổi (thủ tục theo xã, 2026-11-16)

- Kênh cán bộ đọc danh mục thủ tục qua API lõi; bỏ nút công bố thủ tục của cán bộ xã.
- Bảng quản trị bỏ dữ liệu giả của trang gói thủ tục; đường dẫn cũ `/goi-thu-tuc` chuyển sang `/thu-tuc`.

### Sửa lỗi (thủ tục theo xã, 2026-11-16)

- Ràng buộc nghiệp vụ của cơ sở dữ liệu không còn hiện "Server Error" ở Kênh người dân mà báo lời nhắn rõ (422).

### Thêm mới (lưu trữ dữ liệu phi cấu trúc, 2026-11-15)

- Kho đối tượng chuẩn S3 SeaweedFS 4.53 (dịch vụ `storage`), không mở cổng ra ngoài.
- Dịch vụ tệp của lõi `core/files` sau cổng APISIX tại `/files/*`: đính kèm và tải giấy tờ của hồ sơ;
  chỉ nhận PDF, PNG, JPG tối đa 5 MB và kiểm tra nội dung đúng định dạng.
- Mỗi giấy tờ có mã băm SHA-256, được ghi vào sổ ghi nhận của xã. Tệp bị sửa trong kho bị từ chối khi tải (409).
- Quyền xem giấy tờ theo xã bằng RLS; hàm `api.register_document`, `api.document_object` chỉ dịch vụ tệp gọi được.
- Kênh người dân lưu giấy tờ và minh chứng đại diện vào kho đối tượng qua đường nội bộ của dịch vụ tệp;
  tệp cũ trên đĩa vẫn đọc được.
- Màn hình cán bộ xã: hiện mã SHA-256 của giấy tờ, thêm ô "Đính kèm kết quả giải quyết".
- Quét mã độc ClamAV 1.5.2, tùy chọn (`docker compose --profile antivirus`, biến `CLAMAV_HOST`).
- Biến mới trong `.env`: `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `FILES_SERVICE_TOKEN`, `CLAMAV_HOST`.
- `make test` thêm 4 kiểm tra lưu trữ tệp.

### Sửa lỗi (lưu trữ dữ liệu phi cấu trúc, 2026-11-15)

- Cán bộ xã không thấy giấy tờ nào của hồ sơ do thiếu chính sách RLS.
- Nút tải giấy tờ của cán bộ trả dữ liệu giả; nút đính kèm giấy tờ báo lỗi.

### Thêm mới (động cơ quy trình, 2026-11-15)

- Động cơ quy trình BPMN Flowable 8.0.0 và dịch vụ điều phối `core/orchestrator` sau cổng tại `/workflow/*`.
- Sơ đồ `xu-ly-ho-so.bpmn20.xml` quyết định các bước xử lý hồ sơ; đổi quy trình bằng cách sửa sơ đồ, không sửa mã nguồn.
- `GET /workflow/dossiers/<mã>/actions` trả bước hiện tại và các bước được phép; `POST` thực hiện một bước.
- Màn hình cán bộ xã xử lý hồ sơ qua động cơ quy trình.

### Thay đổi (động cơ quy trình)

- Hàm `api.set_dossier_status` chỉ nhận lời gọi từ dịch vụ điều phối; gọi thẳng qua `/rest` bị từ chối (403).
- Bỏ bảng và view `dossier_transitions`.
- Biến mới bắt buộc trong `.env`: `FLOWABLE_ADMIN_PASSWORD`, `WORKFLOW_TOKEN`.
- `make test` tăng lên 15 kiểm tra; CI dựng thêm Flowable và dịch vụ điều phối.

### Thay đổi (chuẩn hóa kho mã, 2026-11-15)

- Mọi tệp có thông tin giấy phép theo chuẩn REUSE (`REUSE.toml`, `LICENSES/`); kiểm tra bằng `reuse lint`.
- Kiểm tra tự động trên mỗi PR bằng GitHub Actions: giấy phép, dựng từ mã nguồn, `make test`, `make test-citizen`.
- Bảng quản trị chạy bằng `docker compose` ở cổng 3001; tài khoản mẫu `quantri` có sẵn trong tệp realm.
- Thêm mẫu issue, mẫu PR, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- Chuyển ghi chú quá trình làm vào `docs/ghi-chu/`.
- `make test-citizen` chạy trong ảnh `node:22-alpine` để kết quả giống nhau trên mọi máy.

### Thay đổi (chạy và dọn dẹp, 2026-11-15)

- `docker compose up` chạy luôn màn hình cán bộ xã ở cổng 3002 (biến mới tùy chọn `COMMUNE_PORT`).
- Ảnh Docker của `apps/commune` dùng Node.js 22 cho thống nhất với `DEPENDENCIES.md`.
- Xóa tệp thừa `default.vue.bak`; sửa bảng kiến trúc bị lặp trong `README.md`.

### Thêm mới (sổ ghi nhận, 2026-11-15)

- Sổ ghi nhận nối chuỗi băm SHA-256 theo từng xã: mỗi sự kiện hồ sơ tự sinh một dòng, không lưu nội dung hồ sơ.
- Chặn sửa, xóa dòng sổ; hàm `api.verify_ledger` tính lại chuỗi và chỉ ra dòng bị sửa.
- View `api.ledger`: quản trị xem mọi xã, cán bộ chỉ xem xã mình.
- Bảng quản trị: màn hình "Kiểm tra hồ sơ đã ký" dùng dữ liệu thật.
- `make test` tăng lên 13 kiểm tra.

### Thêm mới (xử lý hồ sơ, 2026-11-15)

- Hàm `api.set_dossier_status`: cán bộ xã chuyển xử lý, yêu cầu bổ sung, hoàn thành, từ chối hồ sơ của xã mình; kiểm tra vai trò, bước chuyển hợp lệ và lý do bắt buộc ngay trong cơ sở dữ liệu.
- Mỗi lần đổi trạng thái tự ghi lịch sử và gửi thông báo cho người dân.
- View `api.dossier_transitions` liệt kê các bước chuyển được phép.
- `apps/commune`: nút Cập nhật trạng thái và Yêu cầu bổ sung gọi API lõi.
- `make test` tăng lên 12 kiểm tra.

### Thêm mới (màn hình cán bộ xã, 2026-11-15)

- `apps/commune` đăng nhập bằng Keycloak và đọc hồ sơ qua API lõi `/rest`; bỏ tài khoản cứng `canbo.demo`.
- API lọc hồ sơ theo xã tiếp nhận (`receiving_tenant_id`); thêm cột `home_tenant_code`, `category`, `description`, `form_data`, `result_note`, `updated_at` cho `dossiers`.
- Thêm view `dossier_documents`, `procedure_documents`.
- Token truy cập Keycloak có thời hạn 30 phút.

### Thêm mới (lõi, 2026-11-14)

- API dữ liệu PostgREST 16.5 sau cổng APISIX tại `/rest/*`; PostgREST tự kiểm tra lại chữ ký token Keycloak (JWKS).
- Schema `api`: `dossiers`, `dossier_events`, `procedures`, `tenants` (chỉ đọc, số điện thoại được che) và hàm `add_tenant`, `set_tenant_status` (chỉ vai trò `sys_admin`).
- Cách ly xã bằng RLS theo claim `tenant_id` của token; xã bị khóa thì cán bộ xã đó không đọc được hồ sơ nào.
- Bảng quản trị: đăng nhập Keycloak (chỉ `sys_admin`), màn hình Danh sách xã dùng dữ liệu thật (thêm, khóa/mở xã), nút đăng xuất.
- Kiểm thử `make test`: 9 kiểm tra cách ly xã và phân quyền qua gateway.

### Thay đổi

- Mã xã mẫu đổi `XA-DEMO`/`XA-TEST-2` thành `xa-a`/`xa-b` cho khớp tài khoản Keycloak; tự cập nhật trên dữ liệu cũ.
- Kiểm thử Kênh người dân chuyển sang `make test-citizen`.
- Biến mới bắt buộc trong `.env`: `POSTGRES_REST_PASSWORD`.

### Cải thiện cổng Công dân (2026-11-14)

- Sửa quyền UPDATE PostgreSQL cho luồng tạo/sửa bản nháp và nộp hồ sơ, không nới lỏng RLS.
- Phân biệt bản nháp chưa nộp với hồ sơ có thời hạn; chặn bỏ qua bước và khôi phục bản nháp qua SSR.
- Cải thiện kiểm tra upload, bổ sung hồ sơ, tìm kiếm tiếng Việt không dấu và xử lý lỗi API.
- Hiển thị bộ đếm thông báo chưa đọc theo SSE, làm gọn khối hỗ trợ và menu responsive.
- Cho phép in phiếu kết quả không cắt viewport; tăng bộ test tĩnh lên 20.
- Tài liệu triển khai, phạm vi/chức năng chưa hoàn thiện tại `docs/ghi-chu/UPDATE_2026-11-14.md`.

### Thêm mới

- Dịch vụ định danh Keycloak 26.8.2, dùng database riêng trên cùng máy chủ PostgreSQL.
- Realm `communeos` nạp tự động khi khởi động, gồm 5 vai người dùng và claim `tenant_id` trong JWT.
- Hai tài khoản thử thuộc hai xã mẫu.
- Khung kho mã: giấy phép Apache-2.0, README, tài liệu đóng góp.
- Cấu trúc thư mục `core/`, `apps/`, `packs/`, `docs/`.
- Tệp `.env.example` và `Makefile`.
- Cửa ngõ API Apache APISIX 3.20.0 chạy ở chế độ đọc cấu hình từ tệp, không cần etcd.
- Cửa ngõ kiểm chữ ký và nơi cấp của JWT do Keycloak phát hành trên tuyến `/api/*`.
- Biến `KEYCLOAK_PUBLIC_URL` và `GATEWAY_PORT` trong `.env`.
- Bảng quản trị lõi (`core/admin`): khung giao diện, màn hình quản lý xã và gói thủ tục, dùng dữ liệu giả lập.
- PostgREST sau cổng /rest/\*.
- Thêm schema api + RLS cách ly xã.
- Bảng quản trị dùng dữ liệu thật.
- make test
- Biến mới POSTGRES_REST_PASSWORD

### Sửa lỗi

- Bỏ khóa ký token khỏi tệp realm; mỗi nơi cài đặt tự sinh khóa riêng khi khởi động lần đầu.

<!--
Mẫu cho mỗi bản phát hành:

## [0.1.0] - 2026-11-15

### Thêm mới

### Thay đổi

### Sửa lỗi

-->

## Unreleased — Kênh Công dân Nuxt + PostgreSQL mẫu

- Bổ sung giao diện Công dân dùng chung design system theo bản mockup thống nhất.
- Bổ sung bảng, dữ liệu seed và RLS cho PostgreSQL 17.
- Bổ sung API đăng nhập demo ký cookie; danh mục thủ tục, hồ sơ, tệp, thông báo,
  phản hồi và hồ sơ cá nhân.
- Triển khai luồng bản nháp → tải giấy tờ → kiểm tra Poka-yoke → nộp hồ sơ.
- Bổ sung Docker Compose và tài liệu chạy thử; không cam kết OIDC/AI/OTP thật.

## Citizen database connectivity fix (2026-11-13)

- Chạy `db-setup` cho cả volume PostgreSQL cũ, tự tạo schema và seed thủ tục.
- Đồng bộ mật khẩu role `communeos_app` khi triển khai lại; giữ nguyên dữ liệu.
- Cải tiến `/api/health` để kiểm tra bảng, quyền và thủ tục đã được nạp.
- Thêm `make repair-db`, `make doctor` và thông báo lỗi dễ xử lý trong UI.
