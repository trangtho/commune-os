<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->
# Open-Core: nghiệm thu trước phát hành

## Ranh giới và mô hình đe dọa

Tầng 1: API Gateway, Identity, PostgREST/PostgreSQL, Flowable, Files/S3, AI và audit. Tầng 2: các portal và năng lực H-P-D-I; module khai báo nghiệp vụ. Tầng 3: ứng dụng chuyên ngành mở rộng, không phải điều kiện bắt buộc để chạy lõi. `modules/` là mã triển khai tin cậy của quản trị viên hệ thống; không cài module từ request người dùng. SQL/handler module có quyền cao khi cài đặt, không phải sandbox. Không thêm route tùy ý: gateway generator chỉ nhận tên RPC và handler tài khoản công khai hợp lệ, đặt sẵn upstream, phương thức và rate limit; quyền thực tế vẫn phụ thuộc grant/RLS. Kiểm tra review thủ công mọi RPC công khai. Module identity không được trùng client/role/attribute với lõi hoặc module khác. Không tự xóa client, role, schema hay dữ liệu trên hệ thống đã cài module. Thử lõi trống bằng volume mới, không dùng thao tác tắt module như cơ chế gỡ cài đặt bảo mật.

Gateway tạo cấu hình trong volume `gateway-config`; `make up` và `make platform-up` chạy lại generator và khởi động lại gateway. Khi thay cấu hình trên máy chủ, chạy lại identity-setup và db-setup theo quy trình nâng cấp, sau khi backup. Cấu hình module được nạp theo `COMMUNEOS_MODULES`; giá trị rỗng là không module. Không sửa `apisix.yaml` sinh ra trong container. Các route được sinh chỉ hỗ trợ RPC công khai và đăng ký tài khoản công khai; REST/workflow/files dùng namespace có xác thực chung. AI lấy tenant và vai trò từ token đã kiểm chữ ký, không từ trường request; `resourceId` là alias tương thích cho `procedureId`, hợp đồng RPC SQL cũ còn giữ nguyên.

## Ba môi trường nghiệm thu

Dùng từng Docker project **trên máy thử riêng hoặc chạy lần lượt sau khi dừng stack trước**, do các cổng mặc định trùng nhau. Dùng `.env` thử nghiệm, không sao chép dữ liệu thật. `docker compose down` chỉ dừng stack tương ứng; không xóa volume đang dùng. Trên một clone mới, `cp .env.example .env`, thay secret, `make check-env`.

1. Core Only: `COMPOSE_PROJECT_NAME=dxos-core-test COMMUNEOS_MODULES= make platform-up`, rồi `COMPOSE_PROJECT_NAME=dxos-core-test COMMUNEOS_MODULES= make test-platform`. Kiểm tra registry rỗng, truy cập không token bị chặn, không có bảng xã. Dừng stack với `COMPOSE_PROJECT_NAME=dxos-core-test docker compose down`.
2. Doanh nghiệp: `COMPOSE_PROJECT_NAME=dxos-enterprise-test COMMUNEOS_MODULES=doanh-nghiep make platform-up`, rồi `COMPOSE_PROJECT_NAME=dxos-enterprise-test COMMUNEOS_MODULES=doanh-nghiep make test-platform` và `COMPOSE_PROJECT_NAME=dxos-enterprise-test COMMUNEOS_MODULES=doanh-nghiep make example-enterprise`. Gói có dữ liệu demo Công ty A; đọc script để biết tài khoản thử. Bật HTTP localhost rõ ràng với `PORTAL_ALLOW_LOCAL_HTTP=true`, sau đó `COMPOSE_PROJECT_NAME=dxos-enterprise-test COMMUNEOS_MODULES=doanh-nghiep PORTAL_ALLOW_LOCAL_HTTP=true make enterprise-up`. Truy cập `http://localhost:3003`. Portal minh họa dùng Keycloak password grant của client hiện có, session ngắn trong bộ nhớ, không có refresh tự động, không phải triển khai browser SSO Authorization Code + PKCE hoàn chỉnh. Không mở port ra mạng ngoài. Hỏi AI cần khởi động thêm các dịch vụ AI và mô hình. Dừng stack thử.
3. Full: `make up`, `make demo`, `make test`, `make test-sql`, `make example-enterprise`, `make e2e-citizen`, `make portal-smoke`. Kiểm thử trực tiếp trình duyệt của bốn portal; kiểm tra hồ sơ cũ, phiên đăng nhập, API công khai và tenant chéo. Không gộp bản vá vào main nếu một bài tích hợp thất bại.

## IT/OT và vòng đời dữ liệu (prototype)

Trên stack thử mới với `COMMUNEOS_MODULES=doanh-nghiep,iot-demo`, chạy `make platform-up`, `make example-enterprise` rồi `make test-iot` (Node 22). Xem [hướng dẫn module](../modules/iot-demo/README.md). Mô phỏng cảm biến, không kết nối thiết bị thật.

## Bảo mật và quan sát

- `docker compose --profile antivirus up -d antivirus`, đặt `CLAMAV_HOST=antivirus` và `CLAMAV_REQUIRED=true`, tái tạo files. Kiểm tra tệp sạch, mẫu kiểm thử EICAR qua scanner trong môi trường riêng, và lỗi 503 khi scanner không sẵn sàng. `CLAMAV_REQUIRED=true` ngăn chạy Files khi không khai báo host; chưa xác nhận scanner runtime qua healthcheck. Không tuyên bố Zero Trust toàn diện. Keycloak hiện dùng cấu hình demo start-dev, cần HTTPS và hardening khi triển khai thật.
- `make evidence` (Node 22, `GATEWAY_URL` nếu khác mặc định) đo 20 yêu cầu public_platform tuần tự, lưu `evidence/platform.json`; đây không phải benchmark tải đồng thời hay hệ thống Prometheus/Grafana. Không commit báo cáo có dữ liệu nhạy cảm.
- `make backup` và kiểm thử `make restore BACKUP=...` chỉ trên môi trường thử độc lập, xác minh database, tệp, ledger và workflow. Không khôi phục đè production.

## SDK và phát hành

`make module-create NAME=thiet-bi` sinh scaffold schema bị thu hồi quyền PUBLIC. `make module-validate NAME=thiet-bi` kiểm tra manifest, tệp, cấu hình gateway/identity/AI. Không sinh quyền RLS hay BPMN tự động: nhà phát triển phải viết migration, workflow, tests, grant tối thiểu và tài liệu trước khi bật module. Sau review, cài qua COMMUNEOS_MODULES và chạy lại các bước khởi tạo. `make test-open-core` và `make test-architecture` kiểm thử unit/static; CI tích hợp là điều kiện trước merge.

Duyệt `LICENSE`, `REUSE.toml`, chạy `reuse lint`, xem `DEPENDENCIES.md`, kiểm tra lockfile, chạy clean clone, kiểm tra Issues và CHANGELOG. Chốt phiên bản theo quy trình release hiện có; công bố tar.gz, checksum và SBOM thực tế trước nộp. Không coi workflow release là bản phát hành đã công bố.

## Phạm vi chưa hoàn tất

- Identity mới tách client/role/claims công dân; vai trò cán bộ và client `commune-app` còn dùng chung vì hợp đồng PostgREST hiện tại. Các realm cũ không tự xóa cấu hình xã khi bỏ module.
- AI vẫn duy trì chữ ký SQL và enum audience cũ; chưa chuyển đổi toàn bộ sang hợp đồng resource_type/resource_id/module_name.
- Portal doanh nghiệp là demo; cần kiểm thử E2E thật và nâng cấp auth code/PKCE, refresh, MFA trước production.
- Observability mới là phép đo tuần tự và healthcheck; chưa có Prometheus/Grafana.
- Đã có prototype `modules/iot-demo` cho telemetry mô phỏng qua HTTP, RLS, ingest idempotent, cảnh báo Workflow, view tổng hợp theo ngày và xuất JSONL + SHA-256 thủ công. Xem README của module. Chưa có MQTT, định danh thiết bị chuyên dụng, digital twin, lakehouse, lịch archival tự động hoặc snapshot nhất quán. Không xóa dữ liệu giao dịch. Cần kiểm thử tích hợp trước trình diễn.
- Chưa chạy Docker/Keycloak/Flowable/ClamAV/Playwright hoặc công bố release trong môi trường tạo bản vá. Kết quả kiểm thử tích hợp cần CI/máy thật.
