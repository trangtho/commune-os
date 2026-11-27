<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Lịch sử thay đổi

Mọi thay đổi đáng chú ý của dự án được ghi tại đây.
Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
đánh số phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Thêm (tệp đính kèm dùng chung cho mọi gói, 2026-11-28)

- Dịch vụ tệp của lõi đính kèm được tệp cho đối tượng của bất kỳ gói nào: gói khai báo `attachments` trong
  `module.json` (loại đối tượng, bảng ảo, trạng thái còn nhận tệp); `POST`, `GET /files/<loại>/<mã>/attachments`,
  `GET /files/attachments/<id>`. Quyền xem lấy từ bảng ảo của gói bằng token người dùng (RLS của gói); đơn vị phải bật
  gói; kiểm tra định dạng, mã độc, mã băm như giấy tờ hồ sơ.
- `core/db/init/09-tep-dinh-kem.sql`: bảng `core_attachments`, hàm `attachment_register`, `attachment_list`,
  `attachment_object` (chỉ dịch vụ tệp gọi); mỗi tệp ghi một dòng vào sổ ghi nhận của đơn vị.
- Gói doanh nghiệp: đính kèm giấy tờ vào đơn nghỉ phép đang chờ duyệt; kiểm thử thêm 3 mục.

### Thêm (gói nghiệp vụ theo từng đơn vị, 2026-11-28)

- Mỗi đơn vị chỉ dùng các gói được bật cho mình (`core/db/init/08-goi-theo-don-vi.sql`): bảng `tenant_modules`,
  `GET /rest/tenant_modules`, `POST /rest/rpc/set_tenant_module` (chỉ quản trị hệ thống, chỉ gói đang được cài; tắt không
  xóa dữ liệu), `POST /rest/rpc/my_modules`; gói kiểm tra bằng `tenant_has_module()`, `require_module()`.
- Tạo đơn vị chọn gói: `POST /accounts/tenants` nhận `modules` (ví dụ `["xa"]`); lỗi thì hủy đơn vị vừa tạo.
- Gói xã chỉ phục vụ đơn vị bật gói xã: thủ tục, nộp hồ sơ, hồ sơ của cán bộ, danh sách xã khi công dân đăng ký;
  không mở được thủ tục cho đơn vị không dùng gói xã. Màn hình cán bộ từ chối đăng nhập của đơn vị không dùng gói xã.
  Gói doanh nghiệp cũng kiểm tra như vậy. Nâng cấp bản cài cũ: tự bật gói cho các đơn vị đang có dữ liệu của gói (một lần).
- Bảng quản trị: "Danh sách xã" thành "Đơn vị"; chọn gói khi thêm đơn vị; cột gói nghiệp vụ; bật, tắt gói ở trang chi
  tiết; thủ tục, số hồ sơ chỉ hiện với đơn vị dùng gói xã.
- `make demo` bật gói xã cho 2 xã mẫu; kiểm thử lõi và gói doanh nghiệp thêm các mục gói theo đơn vị.

### Sửa lỗi (2026-11-28)

- Trang đăng ký công dân liệt kê cả đơn vị không phải xã (ví dụ "Công ty A").
- Trang đăng ký công dân không cuộn được trên màn hình rộng (từ 1280px): `layouts/blank.vue` đặt khung cố định
  (`citizen-app-shell`, `overflow: clip`) và vùng cuộn trên cùng một thẻ nên `clip` đè `overflow-y-auto`; nay tách khung
  ngoài và vùng cuộn như layout mặc định.

### Thay đổi (tách lõi khỏi gói nghiệp vụ, 2026-11-27)

- Lõi không còn chứa nghiệp vụ nào: `core/db/init/` chỉ còn đơn vị, hàm đọc token, quy trình, sổ ghi nhận, nhật ký tài
  khoản, danh sách gói. Bảng, API, dữ liệu mẫu, kiểm thử SQL, quy trình hồ sơ, gói thủ tục của xã chuyển sang
  `modules/xa/`; ví dụ doanh nghiệp chuyển từ `examples/` sang `modules/doanh-nghiep/`.
- Gói nghiệp vụ khai báo trong `modules/<gói>/module.json`: tệp SQL theo thứ tự chạy, loại đối tượng có quy trình
  (thay `workflow.json`), việc định kỳ. `COMMUNEOS_MODULES` (mặc định `xa,doanh-nghiep`) chọn gói được nạp; `db-setup`
  chạy `core/db/migrate.sh` (lõi, rồi từng gói, ghi vào `core_modules`); `GET /rest/modules`,
  `/public/rpc/public_platform` cho biết gói đã cài.
- Dịch vụ điều phối không còn loại "hồ sơ" và việc định kỳ của Kênh người dân viết sẵn: tất cả lấy từ gói đang bật.
- `rest_pre_request` của lõi gọi các móc do gói ghi danh (`register_request_hook`); gói xã đặt biến RLS của công dân
  trong móc của mình. Vai trò khách `web_anon` tạo ở lõi. Cổng API kiểm tra sức khỏe bằng `public_platform`.
- Thông báo lỗi của hàm đơn vị, `require_staff`, `require_leader` gọi là "đơn vị" thay cho "xã".
- `make test-platform` (`core/tests/platform.sh`): kiểm thử lõi không phụ thuộc gói. CI thêm job "Chỉ lõi, không có gói
  xã" (`COMMUNEOS_MODULES=doanh-nghiep`); `make test-architecture` kiểm tra SQL của lõi không dùng bảng, hàm của gói xã.
- Bỏ `core/db/init/01-tao-database-keycloak.sql` (không dùng; `db-setup` tự tạo cơ sở dữ liệu Keycloak).

### Thêm (lõi dùng chung cho nhiều gói nghiệp vụ, ví dụ doanh nghiệp, 2026-11-27)

- Ví dụ doanh nghiệp chạy trên cùng lõi ([examples/doanh-nghiep](examples/doanh-nghiep/README.md)): đơn vị
  "Công ty A", giám đốc, nhân viên tạo qua API tài khoản của lõi; quy trình BPMN duyệt đơn nghỉ phép; dữ liệu trong
  schema riêng, cách ly đơn vị bằng RLS; ghi sổ ghi nhận. `make example-enterprise` nạp gói và kiểm thử 8 mục qua cổng
  API; CI chạy bài này.
- Dịch vụ điều phối quy trình không còn gắn cứng với hồ sơ: mỗi loại đối tượng khai báo sơ đồ BPMN, bảng ảo, hàm đổi
  trạng thái (`workflow.json` trong thư mục gói, biến `MODULES_DIR`); API `/workflow/<loại>/<mã>/actions`. Hồ sơ thủ
  tục (`/workflow/dossiers/...`) giữ nguyên cách gọi. Trang tài liệu API mô tả và gọi thử được đường dẫn mới.
- Sổ ghi nhận: hàm dùng chung `public.ledger_record` cho mọi gói nghiệp vụ; cách ghi sổ hồ sơ và công thức băm không
  đổi, chuỗi cũ vẫn hợp lệ.
- `docs/LOI_DUNG_CHUNG.md`: ánh xạ H-P-D-I, ranh giới giữa lõi dùng chung và gói nghiệp vụ xã, các bước thêm nghiệp
  vụ mới, giới hạn hiện tại. README giới thiệu CommuneOS là lõi dùng chung, một cửa cấp xã là ứng dụng minh họa.

### Thay đổi (chuẩn hóa kiến trúc portal, 2026-11-26)

- Màn hình cán bộ gọi API lõi/Workflow qua APISIX thay cho truy vấn PostgreSQL trực tiếp; gỡ `pg` và `@types/pg` khỏi ứng dụng cán bộ.
- Bảng quản trị và màn hình cán bộ dùng cookie HttpOnly mã hóa, làm mới phiên qua Keycloak; API quản trị đi qua BFF. Sửa lỗi mất phiên và HTTP 503 khi tải lại màn hình cán bộ.
- Đồng bộ background, biến CSS dùng chung; cải thiện responsive của màn hình cán bộ. Chuẩn hóa healthcheck, Docker build bằng `npm ci` và kiểm thử kiến trúc.
- Đồng bộ secret của client `accounts-service` khi khởi tạo Keycloak; bổ sung migration kiểm tra trạng thái hồ sơ khi chuyển Workflow.
- Demo HTTP chỉ nới cookie khi bật `PORTAL_ALLOW_LOCAL_HTTP` cho loopback/IP nội bộ RFC1918; giữ `Secure` trên HTTPS và địa chỉ công cộng. Mặc định cổng portal chỉ bind loopback, có thể chọn IP LAN bằng `PORTAL_BIND_ADDRESS`.
- Hỗ trợ reverse proxy HTTPS bằng Origin công khai riêng của từng portal; kiểm tra chống yêu cầu ghi khác nguồn không tin header chuyển tiếp từ client.

### Thay đổi (dựng ổn định từ mã nguồn, CI kiểm thử toàn bộ, 2026-11-24)

- Healthcheck cho Keycloak (`/health/ready`), cổng API (gọi một API công khai tới PostgREST, PostgreSQL), Flowable,
  SeaweedFS, các dịch vụ Node của lõi, Ollama, trang tài liệu API và ba ứng dụng. Dịch vụ phụ thuộc chờ phía trước
  sẵn sàng (`condition: service_healthy`), không còn cảnh ứng dụng chạy trước khi Keycloak hay cổng sẵn sàng.
- `make up` chờ tới khi mọi dịch vụ sẵn sàng và báo dịch vụ nào lỗi (`core/tests/wait-ready.sh`); thêm `make ready`.
- CI dựng toàn bộ từ mã nguồn như `make up` (trừ mô hình AI), gồm build ba ứng dụng Nuxt, rồi chạy `make demo`,
  `make test`, `make test-sql` (mọi bài SQL), `make test-citizen` và `make e2e-citizen` (Playwright); lưu ảnh chụp,
  trace khi lỗi.
- `make e2e-citizen`: chạy kiểm thử giao diện trong ảnh Playwright chính thức, không cần cài trình duyệt.
  Sửa các bài e2e đã lỗi thời theo giao diện hiện tại; bài trợ lý AI tự bỏ qua khi chưa có mô hình.

### Sửa lỗi (2026-11-24)

- Cổng API trả 502 sau khi một dịch vụ khởi động lại (Docker cấp IP mới, APISIX giữ IP cũ theo TTL của DNS): chỉ giữ
  kết quả phân giải 5 giây (`dns_resolver_valid`).
- Kênh người dân: trang chi tiết nhóm hồ sơ (`/lien-thong/{id}`) và chi tiết yêu cầu hỗ trợ (`/yeu-cau-ho-tro/{id}`)
  không bao giờ hiện, luôn hiện trang danh sách (trang danh sách là route cha không có `<NuxtPage>`); chuyển trang danh
  sách thành `index.vue`.
- Kênh người dân: trang Hồ sơ cá nhân lỗi 500 với công dân chưa có số điện thoại hoặc địa chỉ (như công dân tự đăng
  ký bằng email).
- Kênh người dân: trang "Tìm thủ tục qua câu hỏi" (`/goi-y-thu-tuc`) chỉ dùng dữ liệu công khai nhưng bắt đăng nhập.
- Kênh người dân, màn hình cán bộ: đường dẫn `/api/...` không có trả về trang đăng nhập (200) thay vì 404.

### Thay đổi (khởi tạo tài khoản theo vai trò, tách dữ liệu mẫu, 2026-11-24)

- Cài mới không còn tài khoản mẫu: tệp realm chỉ còn tài khoản dịch vụ. Người cài đặt tài khoản quản trị hệ thống
  trong `.env` (`COMMUNEOS_ADMIN_USERNAME`, `COMMUNEOS_ADMIN_PASSWORD`); `make check-env` từ chối mật khẩu trống, mật
  khẩu mẫu hoặc dưới 10 ký tự (`core/identity/check-admin-env.sh`); `identity-setup` tạo tài khoản này và đồng bộ mật
  khẩu theo `.env` mỗi lần `make up`. Chính sách mật khẩu của realm: tối thiểu 8 ký tự, có chữ và số.
- Quản trị hệ thống tạo xã kèm tài khoản lãnh đạo xã trong một lần (`POST /accounts/tenants`, form "Thêm xã" của bảng
  quản trị), mật khẩu tạm hiện một lần; tạo tài khoản lỗi thì xã vừa tạo bị hủy (`api.remove_new_tenant`). Trang chi
  tiết xã có tab "Tài khoản quản lý": cấp lại mật khẩu tạm, khóa / mở, thêm lãnh đạo
  (`/accounts/tenants/{code}/leaders`). Lãnh đạo mới phải đổi mật khẩu tạm khi đăng nhập lần đầu, như cán bộ.
- Người dân tự đăng ký ở Kênh người dân (`/dang-ky`): họ tên, tên đăng nhập, email hoặc số điện thoại, xã cư trú đang
  hoạt động, mật khẩu, đồng ý xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP. Lõi tạo hồ sơ công dân
  (`api.system_register_citizen`, ghi `citizens.privacy_consent_at` và nhật ký sử dụng dữ liệu) và tài khoản Keycloak
  vai trò `citizen` gắn `citizen_id`; route công khai `/public/accounts/register` có giới hạn số lần gọi
  (`core/db/init/35-account-onboarding.sql`).
- Tách dữ liệu mẫu: `core/db/seed/seed.sql` chỉ còn danh mục thủ tục; `make demo` (`core/demo`) tạo 2 xã mẫu, lãnh
  đạo, cán bộ, công dân qua chính các API trên rồi nạp hồ sơ mẫu; chạy lại được, mật khẩu chung `DEMO_PASSWORD`
  (mặc định `Demo@2026!`). Bản cài cũ còn tài khoản mẫu mật khẩu `12345` được đặt lại về `DEMO_PASSWORD`.
- `make test` và các bài `make *-test` chạy `make demo` trước; bài kiểm thử SQL đọc mã xã, công dân mẫu theo mã xã và
  tên đăng nhập thay cho mã cố định. `make test` thêm kiểm tra tạo xã kèm lãnh đạo, hủy xã khi tạo tài khoản lỗi,
  quản lý lãnh đạo không vượt xã và đăng ký công dân. CI đặt mật khẩu quản trị ngẫu nhiên và chạy `make demo`.
- Mật khẩu tạm do dịch vụ tài khoản cấp luôn có cả chữ và số (trước đây có thể chỉ có chữ).

### Sửa lỗi (giao diện, 2026-11-24)

- Trang nộp hồ sơ (bước giấy tờ) và các trang có ô chọn tệp: sau khi chọn tệp, cả khung ứng dụng trượt lên làm lộ ảnh
  nền và mất phần dưới nội dung. Ô chọn tệp ẩn (`sr-only`, `position: absolute`) không có mốc vị trí nên kéo dài chiều
  cao trang, trình duyệt cuộn cả trang khi focus. Vùng nội dung cuộn nay là mốc vị trí, khung ngoài dùng
  `overflow: clip` (Kênh người dân và màn hình cán bộ).
- Màn hình cán bộ tự cập nhật khi người khác thay đổi dữ liệu (đề nghị mới chờ duyệt, kết quả phê duyệt trong hồ sơ cá
  nhân, danh sách nhân viên, việc được giao, thông báo), không cần F5: tải lại dữ liệu trang mỗi 15 giây khi tab đang mở
  và ngay khi quay lại tab (`apps/commune/composables/useAutoRefresh.ts`); biểu mẫu đang nhập không bị ghi đè.

### Thay đổi (Kênh người dân không còn quyền đọc ghi PostgreSQL trực tiếp, 2026-11-24)

- Mọi thao tác dữ liệu của Kênh người dân đi qua cổng APISIX tới API của lõi. Vai trò `communeos_app` bị thu hồi mọi
  quyền trên bảng, chuỗi số, hàm (`core/db/init/34-citizen-direct-access.sql`); chỉ còn kết nối nhận tín hiệu
  (LISTEN) cho thông báo thời gian thực. `utils/database.ts` chỉ còn kết nối này.
- Đăng nhập OIDC bên ngoài (tùy chọn) liên kết tài khoản, ghi địa phương cư trú và thông tin đã xác minh qua
  `api.citizen_service_oidc_link`, bằng tài khoản dịch vụ Keycloak của client `citizen-app` (bật `serviceAccountsEnabled`,
  dùng secret đã có, không thêm biến môi trường).
- Gửi nhắc việc và quét dữ liệu đến hạn rà soát lưu trữ chuyển từ plugin của Kênh người dân sang dịch vụ điều phối của
  lõi (`CITIZEN_REMINDERS_ENABLED`, `CITIZEN_RETENTION_SCAN_ENABLED` đặt cho `orchestrator`), gọi
  `api.system_*` bằng khóa nội bộ.
- `/api/health` của Kênh người dân kiểm tra lõi qua cổng thay cho truy vấn cơ sở dữ liệu.
- Các bộ kiểm thử RLS (`make *-test`) chạy bằng vai trò `citizen-app`, vai trò Kênh người dân thực sự dùng.
- Sửa README, `docs/CITIZEN_SETUP.md`, `core/db/README.md`, `core/rest/README.md`, `apps/citizen/README.md` và tài liệu
  trong `apps/citizen/docs` theo hiện trạng.

### Thay đổi (API công khai cho Kênh người dân qua lõi, 2026-11-24)

- Kho tri thức của trợ lý, phiên bản và nguồn văn bản thủ tục, hướng dẫn biểu mẫu, kênh thực hiện, gợi ý thủ tục, địa
  phương, phân tích tình huống, phiên chuẩn bị tại quầy (không đăng nhập) và tra cứu mã kiểm chứng kết quả gọi các hàm
  `api.public_*` của lõi (`core/db/init/33-citizen-api-public.sql`) qua `/public/rpc/*` cho khách hoặc `/rest/rpc/*`
  bằng token công dân. Hàm công khai chỉ trả dữ liệu đã công bố; với token công dân thì lọc theo xã của công dân.
  Phần riêng của công dân (lịch sử, tùy chọn, tuyến tiếp nhận) là hàm `citizen_*` chạy bằng quyền công dân.
- Cổng APISIX liệt kê từng hàm công khai được mở trên `/public/rpc/`; hàm khác không gọi được khi chưa đăng nhập.
  `make test` thêm kiểm tra này (48 kiểm tra).
- Bỏ `utils/citizen-preferences.ts` (tùy chọn, tuyến tiếp nhận đọc qua lõi).

### Thay đổi (cá nhân hóa của Kênh người dân qua lõi, 2026-11-24)

- 25 API quyền chia sẻ dữ liệu, nhật ký sử dụng dữ liệu cá nhân, lưu trữ và đề nghị về dữ liệu, đồng bộ thông tin tự
  khai, tùy chọn cá nhân hóa, lộ trình sự kiện cuộc sống, nhắc việc, sổ giao dịch, không gian làm việc, bước đang soạn và
  tín hiệu khó khăn ẩn danh gọi 26 hàm `api.*` của lõi (`core/db/init/32-citizen-api-personal.sql`) thay cho truy vấn
  PostgreSQL trực tiếp. Bỏ `utils/privacy-events.ts` (nhật ký sử dụng dữ liệu ghi trong lõi).

### Thay đổi (hỗ trợ, góp ý, lịch sử trò chuyện của Kênh người dân qua lõi, 2026-11-24)

- 11 API yêu cầu hỗ trợ, góp ý, tin nhắn hỗ trợ theo hồ sơ, lịch sử trò chuyện với trợ lý, cùng phần lưu câu hỏi / câu
  trả lời và phạm vi thủ tục của trợ lý, gọi 14 hàm `api.*` của lõi (`core/db/init/31-citizen-api-support.sql`) thay
  cho truy vấn PostgreSQL trực tiếp. Cán bộ trả lời yêu cầu hỗ trợ qua API cán bộ của lõi, công dân thấy ngay.

### Thay đổi (lịch hẹn một cửa, lịch tư vấn của Kênh người dân qua lõi, 2026-11-24)

- 8 API đặt lượt tại bộ phận một cửa và đặt lịch tư vấn gọi 8 hàm `api.*` của lõi
  (`core/db/init/30-citizen-api-appointment.sql`) thay cho truy vấn PostgreSQL trực tiếp; khung giờ vẫn chỉ do cán bộ
  công bố, số thứ tự cấp trong lõi.

### Thay đổi (đại diện nộp thay, gia đình, nhóm thủ tục của Kênh người dân qua lõi, 2026-11-24)

- 10 API đại diện nộp thay (đăng ký, minh chứng, thu hồi, nhật ký), trang gia đình và nhóm thủ tục nộp cùng lúc gọi
  10 hàm `api.*` của lõi (`core/db/init/29-citizen-api-representation.sql`) thay cho truy vấn PostgreSQL trực tiếp.
  Kiểm tra quyền đại diện, người kê khai dùng chung hàm của lõi; bỏ bản sao kiểm tra trong `utils/representations.ts`.
- Sửa tên tệp khi tải minh chứng đại diện (trước đây thừa dấu ngoặc kép: `minh-chung."pdf"`).
- `make guidance-batches-test` chỉ kiểm tra nhóm thủ tục do chính bài kiểm thử tạo, không còn lỗi khi công dân mẫu
  đã có nhóm thủ tục thật.

### Thay đổi (trang chi tiết hồ sơ của Kênh người dân qua lõi, 2026-11-24)

- 25 API của trang chi tiết hồ sơ (bổ sung theo yêu cầu, hạn giải quyết, công đoạn, lộ trình, nhận kết quả, mã chuyển
  hồ sơ tại quầy, đề nghị điều chỉnh / chuyển cơ quan, đánh giá giai đoạn, kiểm tra trước khi nộp, xem trước bộ hồ sơ,
  cập nhật phiên bản thủ tục, tạo lại hồ sơ, mã kiểm chứng kết quả, trợ lý hồ sơ) gọi 27 hàm `api.*` của lõi
  (`core/db/init/28-citizen-api-case.sql`) thay cho truy vấn PostgreSQL trực tiếp. Diễn giải trạng thái, gợi ý bước
  tiếp và kiểm tra biểu mẫu vẫn dùng mã dùng chung `shared/`.
- Tạo lại hồ sơ từ hồ sơ đã kết thúc dùng chung quy tắc với tạo bản nháp mới (`api.citizen_application_create`): ghim
  phiên bản thủ tục, kiểm tra xã đã mở thủ tục.
- Mã chuyển hồ sơ tại quầy và mã kiểm chứng kết quả: lõi chỉ nhận mã băm SHA-256, mã gốc chỉ trả cho công dân.

### Thay đổi (kho giấy tờ, tự điền biểu mẫu của Kênh người dân qua lõi, 2026-11-24)

- Kho giấy tờ cá nhân (xem, thêm giấy tờ và phiên bản, đổi tên, lưu trữ, đặt hạn, tải tệp), tự điền biểu mẫu và dùng
  giấy tờ trong kho cho hồ sơ gọi 9 hàm `api.*` của lõi qua cổng (`core/db/init/27-citizen-api-vault.sql`) thay cho
  truy vấn PostgreSQL trực tiếp. Mỗi giao dịch cũ là một hàm, chạy bằng quyền công dân nên RLS giữ nguyên; kiểm tra
  quyền tái sử dụng, hạn dùng, quyết định lưu trữ và nhật ký sử dụng dữ liệu cá nhân nằm trong lõi.
- Vai trò `citizen-app` của lõi nhận đúng các quyền vai trò `communeos_app` đang có (trừ hàm dành cho cán bộ), để các
  đợt sau chuyển tiếp mà không đổi chính sách RLS.
- Ngày hết hạn giấy tờ trả về dạng `YYYY-MM-DD` (trước đây kèm giờ), ô sửa hạn hiện đúng ngày.

### Thay đổi (chức năng cán bộ của Kênh người dân chuyển vào lõi, 2026-11-24)

- 22 API `/api/internal/*` của Kênh người dân (yêu cầu hỗ trợ, mã chuyển hồ sơ tại quầy, đề nghị điều chỉnh và chuyển
  cơ quan, giao nhận kết quả, yêu cầu về dữ liệu cá nhân, rà soát lưu trữ, đồng bộ, báo cáo tổng hợp, công bố phiên bản
  thủ tục, gửi nhắc việc) trở thành 24 hàm `api.*` của lõi (`core/db/init/26-citizen-staff-api.sql`), gọi qua cổng
  `/rest/rpc/*` bằng token Keycloak của cán bộ. Xã lấy từ claim `tenant_id`, mã cán bộ từ `sub`, vai trò từ token:
  lãnh đạo xã cho dữ liệu cá nhân, lưu trữ, đồng bộ, báo cáo; quản trị hệ thống cho công bố thủ tục, gửi nhắc việc.
  Kiểm tra dữ liệu đầu vào của ứng dụng cũ chuyển vào các hàm này.
- Dịch vụ tệp của lõi thêm `GET /files/handoffs/{id}/documents/{id}` để cán bộ xã tiếp nhận tải giấy tờ trong mã chuyển
  hồ sơ tại quầy.
- Bỏ khóa dùng chung `CITIZEN_STAFF_BRIDGE_TOKEN`, `CITIZEN_GOVERNANCE_TOKEN` và cơ chế truyền xã, mã cán bộ qua header.
- `make test` thêm kiểm tra phân quyền cho các API này (47 kiểm tra).

## [0.1.0] - 2026-11-24

Bản phát hành đầu tiên. Lõi headless đa xã (Keycloak, APISIX, PostgreSQL + PostgREST với RLS, Flowable, SeaweedFS,
sổ ghi nhận chống sửa, AI chạy cục bộ, trang tài liệu API) và ba ứng dụng: Kênh người dân, màn hình cán bộ xã, bảng
quản trị hệ thống. Kiểm thử: `make test` 46 kiểm tra qua cổng API, `make test-citizen` 124 kiểm tra, các bộ
`make *-test` (RLS, ROLLBACK), `reuse lint`.

### Thêm mới (quy trình phát hành, 2026-11-24)

- `.github/workflows/release.yml`: đẩy tag `v*.*.*` thì kiểm tra giấy phép, kiểm tra số phiên bản khớp tag, đóng gói
  mã nguồn, tạo SBOM (SPDX và CycloneDX), mã băm SHA-256 và bản nháp GitHub Release kèm các tệp đó.
- Số phiên bản ba ứng dụng và đặc tả API dịch vụ lõi thống nhất là 0.1.0.

### Thêm mới (trang tài liệu API của lõi, 2026-11-23)

- Trang tài liệu API (Swagger UI, dịch vụ `api-docs`) tại `/docs/` của cổng APISIX (mặc định
  http://localhost:9080/docs/): đặc tả viết tay cho `/workflow`, `/files`, `/accounts`, `/ai`, `/public` (tham số,
  phản hồi mẫu, mã lỗi) và đặc tả PostgREST tự sinh cho toàn bộ `/rest`. Nút **Authorize** đăng nhập Keycloak qua
  cổng, token được tự gắn vào lời gọi thử của cả hai đặc tả.
- `core/db/init/25-api-comments.sql`: mô tả tiếng Việt cho mọi hàm, bảng ảo của schema `api`, hiện trong tài liệu
  OpenAPI của PostgREST.
- PostgREST xuất tài liệu OpenAPI đầy đủ (`PGRST_OPENAPI_MODE=ignore-privileges`, chỉ cấu trúc, không có dữ liệu),
  kèm cơ chế xác thực JWT và địa chỉ cổng `/rest`.

### Sửa lỗi (đăng nhập sau khi cập nhật mã, kiểm thử, tài liệu, 2026-11-23)

- Máy đã cài từ trước, `git pull` rồi `make up` thì `orchestrator`, `accounts`, `files`, `ai-gateway` vẫn chạy mã cũ
  (mã nguồn gắn từ `core/` vào container, compose thấy cấu hình không đổi nên không khởi động lại): thiếu API mới, đăng
  nhập và nộp hồ sơ lỗi. `make up` nay khởi động lại các dịch vụ này cùng `gateway`. Đã kiểm tra nâng cấp từ bản `ceb241b`
  giữ nguyên dữ liệu: đăng nhập ba ứng dụng và `make test` đều đạt.
- `.env` tạo từ bản cũ thiếu biến mới (ví dụ `CITIZEN_KEYCLOAK_SECRET`) thì dịch vụ vẫn chạy nhưng đăng nhập công dân
  lỗi. `make up` nay chạy `make check-env` trước: thiếu hoặc để trống biến bắt buộc thì dừng và báo tên biến.
- Màn hình cán bộ và bảng quản trị báo "sai tên đăng nhập hoặc mật khẩu" cả khi Keycloak chưa khởi động xong; nay chỉ báo
  vậy khi Keycloak trả lỗi sai mật khẩu, còn lại báo hệ thống định danh đang khởi động hoặc cấu hình chưa đúng.
- Kiểm tra phạm vi trợ lý AI trong `make test` tự tắt thủ tục kết hôn ở xã A trong lúc kiểm tra rồi trả lại trạng thái cũ;
  trước đây chỉ đạt trên máy đã tắt thủ tục này bằng tay, lỗi trên bản cài mới.
- README: hướng dẫn sau `git pull`, đổi `POSTGRES_PORT` khi cổng 5432 đã dùng; bỏ dòng lặp ở mục Cấu hình; sửa
  "đa thuê ước" thành "đa xã", "sổ cái" thành "sổ ghi nhận" cho thống nhất; mục Kênh người dân đưa lên trước phần
  Đóng góp.
- `make vault-autofill-test` chỉ kiểm tra giấy tờ do chính bài kiểm thử tạo, không còn lỗi khi công dân mẫu đã có
  giấy tờ trong kho; kiểm tra thêm hai chiều: mỗi công dân không thấy giấy tờ, phiên bản giấy tờ của người khác.
- Sửa liên kết hỏng trong `apps/admin/README.md`; cập nhật `docs/QUAN_LY_NHAN_VIEN.md` theo mục "Việc được giao" mới.

### Thay đổi (làm mới giao diện ba ứng dụng, 2026-11-23)

- Cùng một hệ thống giao diện cho ba ứng dụng, mỗi ứng dụng một màu chủ đạo (người dân xanh dương, cán bộ xanh ngọc,
  quản trị chàm); phông Be Vietnam Pro đóng gói cùng ứng dụng (không tải từ máy chủ ngoài); chữ xám đậm hơn cho dễ đọc.
- Nội dung luôn nằm trên tấm nền đặc, ảnh nền chỉ lộ ra hai bên, chữ không còn chìm vào ảnh.
- Kênh người dân: bỏ cột trái, cột phải và chân trang; thanh tiêu đề nền xanh trơn, giống nhau ở mọi trang; bốn bước nộp hồ sơ chỉ hiện khi đang nộp;
  trang chủ có ô tìm thủ tục, ba việc chính và hồ sơ đang giải quyết; danh mục thủ tục lọc bằng nút chủ đề;
  trang chi tiết thủ tục có tóm tắt giấy tờ, lệ phí, thời hạn và nút nộp cố định trên điện thoại;
  trang mới `/tai-khoan` gom các chức năng phụ.
- Màn hình cán bộ: bỏ ảnh tiêu đề, cột hướng dẫn bên phải và chân trang; ô tìm hồ sơ theo mã ở đầu trang;
  trang tổng quan còn 4 ô số liệu bấm được và danh sách việc cần làm xếp theo hạn; danh sách hồ sơ lọc bằng nút trạng thái
  (có lọc "Quá hạn"), mở được bằng đường dẫn `/ho-so?status=...`.
- Màn hình cán bộ: "Việc được giao" tách khỏi Hồ sơ cá nhân thành mục riêng trên menu (`/viec-duoc-giao`), có số việc chưa
  xong; trang tổng quan hiện việc lãnh đạo giao, quá hạn lên đầu.
- Bảng quản trị: trang Tổng quan mới (xã, thủ tục, tình trạng sổ ghi nhận); thanh bên sáng; sổ ghi nhận hiện tên xã và
  tên tiếng Việt cho mọi loại thao tác.
- Trợ lý AI nổi: tiêu đề một dòng, câu hỏi gợi ý, mở toàn màn hình trên điện thoại.
- Gỡ hai logo cơ quan, tổ chức khỏi header và favicon vì không có quyền sử dụng; thay bằng biểu trưng CommuneOS do nhóm
  tự vẽ (`public/images/logo-communeos.svg`, mỗi ứng dụng một màu).
- Sửa lỗi trang bổ sung hồ sơ, xem kết quả, đánh giá, yêu cầu... của một hồ sơ chỉ hiện lại trang chi tiết: trang chi tiết
  chuyển thành `pages/ho-so/[id]/index.vue` ở cả Kênh người dân và màn hình cán bộ, để các trang con hiển thị đúng.
- Sửa lỗi trang Thông báo của cán bộ luôn trống dù có thông báo; trang làm gọn: khung gửi thông báo cho công dân thu gọn
  (chỉ lãnh đạo xã thấy), bấm vào thông báo là đánh dấu đã đọc và mở hồ sơ liên quan.
- Màn hình cán bộ, danh mục thủ tục: nút "Nộp thử" dẫn tới trang không tồn tại; bỏ nút này, thẻ thủ tục chỉ còn "Xem chi tiết"
  (cán bộ tra cứu thủ tục, không nộp hồ sơ). Bỏ nút "Thêm thủ tục mới" không làm gì (danh mục do bảng quản trị quản lý).

### Thêm mới (trợ lý AI cho hai kênh, 2026-11-22)

- Nút "Hỏi trợ lý AI" nổi trên mọi trang của Kênh người dân và màn hình cán bộ.
- Lõi giới hạn phạm vi trợ lý theo token đã ký: chỉ thủ tục xã của người hỏi đang mở; hướng dẫn nghiệp vụ nội bộ
  (`core/db/init/24-staff-guide.sql`) chỉ cán bộ thấy; hàm tìm kiếm không gọi thẳng được bằng token người dùng.
- Lõi từ chối câu hỏi tra cứu thông tin của người cụ thể hoặc mã hồ sơ; trợ lý không đọc hồ sơ hay dữ liệu cá nhân.
- `make test` thêm 1 kiểm tra AI, tổng 46.

### Thay đổi (giao diện, 2026-11-22)

- Hình nền trống đồng, hoa sen cho Kênh người dân, màn hình cán bộ và bảng quản trị (`public/images/nen-trong-dong.webp`,
  nén WebP 49 KB); khung nội dung giữ nền trắng, bỏ nền khi in.

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

### Sửa lỗi

- Bỏ khóa ký token khỏi tệp realm; mỗi nơi cài đặt tự sinh khóa riêng khi khởi động lần đầu.

### Thêm mới (Kênh người dân bản đầu, Nuxt + PostgreSQL, 2026-11-13)

- Giao diện Kênh người dân dùng chung hệ thống thiết kế theo bản phác thảo thống nhất.
- Bổ sung bảng, dữ liệu seed và RLS cho PostgreSQL 17.
- Bổ sung API đăng nhập demo ký cookie; danh mục thủ tục, hồ sơ, tệp, thông báo,
  phản hồi và hồ sơ cá nhân.
- Luồng bản nháp → tải giấy tờ → kiểm tra chống sai sót (Poka-yoke) → nộp hồ sơ.
- Docker Compose và tài liệu chạy thử (khi đó chưa có OIDC, AI, OTP thật).

### Sửa lỗi (kết nối cơ sở dữ liệu Kênh người dân, 2026-11-13)

- Chạy `db-setup` cho cả volume PostgreSQL cũ, tự tạo schema và seed thủ tục.
- Đồng bộ mật khẩu role `communeos_app` khi triển khai lại; giữ nguyên dữ liệu.
- Cải tiến `/api/health` để kiểm tra bảng, quyền và thủ tục đã được nạp.
- Thêm `make repair-db`, `make doctor` và thông báo lỗi dễ xử lý trên giao diện.

[Chưa phát hành]: https://github.com/trangtho/commune-os/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/trangtho/commune-os/releases/tag/v0.1.0
