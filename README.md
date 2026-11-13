<!-- SPDX-License-Identifier: Apache-2.0 -->
# CommuneOS · Bản mã nguồn thử nghiệm v0.3.0-demo

**Nền tảng DX-OS Open-Core mô phỏng tác nghiệp hành chính cấp xã — giao diện chung, phân quyền theo 6 vai trò.**

> **Trạng thái trung thực:** đây là **bản prototype có mã nguồn và API chạy kiểm thử cục bộ**, KHÔNG phải sản phẩm đã hoàn tất cả 60 chức năng, KHÔNG phải hệ thống cung cấp dịch vụ công thật. Tài liệu đặc tả ban đầu nằm tại `docs/README_SPEC_GOC.md` và file Word gốc tại `docs/CommuneOS_60_chuc_nang.docx`.

## Thành phần đã viết

- **Nuxt 3 + TypeScript:** 6 dashboard cùng design system theo các ảnh tham chiếu, menu đổi theo vai trò, trang hồ sơ/tiến trình/giấy tờ, tạo hồ sơ, lịch hẹn, hàng chờ, thống kê, wiki, công cụ tìm kiếm trích đoạn, quản trị tenant/gói.
- **FastAPI headless:** JWT, role/tenant, hồ sơ điện tử, kiểm tra giấy tờ bắt buộc và JSON Schema (`422`), chuyển trạng thái nghiệp vụ, tài liệu và SHA-256, hàng chờ, lịch hẹn, phản hồi, bảng số liệu không PII.
- **PostgreSQL:** mô hình bảng và SQL RLS với `FORCE ROW LEVEL SECURITY`, bối cảnh tenant xác minh từ JWT; SQLite chỉ phục vụ chạy nhanh và unit test, không tương đương PostgreSQL RLS.
- **Quy trình:** máy trạng thái chạy được; adapter Flowable REST/BPMN tùy chọn **chưa tích hợp kiểm thử trên Docker**.
- **Lưu trữ:** SILO (nhánh S3-compatible của MinIO) trong Compose, vẫn dùng tên dịch vụ `minio` để giữ tương thích backend; local file system cho thử nghiệm offline.
- **Gói thủ tục:** `khai-sinh`, `ho-kinh-doanh`, `xac-nhan-cu-tru`, biểu mẫu JSON Schema và wiki giả lập, tải ZIP với kiểm tra cấu trúc.
- **Bảo mật/kiểm toán:** logic phân quyền backend, hash-chain ledger theo xã, chặn sửa các bản ghi audit ở PostgreSQL, API đối soát hash.

## 60 chức năng và minh chứng

Xem **[`docs/FEATURE_MATRIX.md`](docs/FEATURE_MATRIX.md)**: 10 chức năng có mã xử lý cơ bản, 26 chức năng mới đạt một phần và 24 chức năng chưa có luồng thực thi. Không trình bày những chức năng chưa có mã như đã hoàn thành.

## Chạy nhanh (local demo)

Cần Docker + Compose. Các giá trị trong `.env.example` là **ví dụ không an toàn để dùng ngoài máy cá nhân**:

```bash
cp .env.example .env
# Thay tất cả mật khẩu, khóa demo trong .env
make up
make ps
```

Truy cập [http://localhost:3000](http://localhost:3000). Chọn một trong sáu vai trò giả lập. Gateway API: [http://localhost:8080/health](http://localhost:8080/health); tài liệu API: [http://localhost:8080/docs](http://localhost:8080/docs).

Tùy chọn `make up-identity` để có Keycloak, `make up-workflow` sau khi đặt `FLOWABLE_ENABLED=true`. **Chưa xác minh startup Compose trong môi trường tạo mã này** vì không có Docker. Xem [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) cho cách chạy thử offline bằng Python/Node; xem [`docs/FIX_MINIO_MACOS.md`](docs/FIX_MINIO_MACOS.md) để sửa lỗi kéo image MinIO trên MacBook mà không làm mất `.env`/volume.

## Kiểm thử API cục bộ

```bash
pip install -r core/orchestrator/requirements.txt pytest
make test
```

Bài kiểm thử đã được thực hiện trong môi trường tạo mã và cho kết quả **10/10 passed** với SQLite: `401` khi không có JWT, cách ly dữ liệu ở API giữa hai tenant, Poka-yoke `422`, chuyển bước/thẩm định/phê duyệt/đóng hồ sơ + hash ledger, quyền công dân và truy xuất wiki. Bài kiểm tra PostgreSQL RLS `test_postgres_rls.py` được cung cấp nhưng **chưa chạy**; cần cơ sở dữ liệu PostgreSQL riêng.

## Kiến trúc kho mã

```text
core/
  orchestrator/     FastAPI & nghiệp vụ
  db/migrations/    PostgreSQL RLS, append-only
  gateway/          Apache APISIX standalone YAML
  identity/         Keycloak realm/client/roles
apps/commune/       Nuxt 3, 6 role UI thống nhất
packs/              3 gói YAML/BPMN/DMN/JSON Schema/wiki
docs/               Kiến trúc, bảo mật, OpenAPI, đối soát 60 yêu cầu, ảnh mẫu
scripts/            Công cụ tạo gói & ma trận
```

## Trạng thái tích hợp cần hoàn thiện

Hiện chưa có việc kiểm tra token ở lớp APISIX (FastAPI có kiểm JWT); chưa có **PostgREST, Metabase, OCR PaddleOCR, RAG embedding/pgvector/Ollama, BPMN/DMN đầy đủ, ClamAV trong Compose, CI quét license/bảo mật hoặc bộ khôi phục liên thông**. Không công khai hệ thống như đã đáp ứng toàn bộ kiến trúc trong README gốc.

**Tài liệu:** [`TEST_RESULTS`](docs/TEST_RESULTS.md) · [`ARCHITECTURE`](docs/ARCHITECTURE.md) · [`DEPLOYMENT`](docs/DEPLOYMENT.md) · [`SECURITY`](docs/SECURITY.md) · [`FEATURE_MATRIX`](docs/FEATURE_MATRIX.md) · [`OpenAPI`](docs/openapi.yaml).

**Giấy phép mã tự viết:** Apache-2.0 (`LICENSE`). Phải xác minh từng giấy phép phụ thuộc và hình ảnh/container trước khi phân phối hay công bố bản dự thi. Dữ liệu và thủ tục trong seed là giả lập, không dùng giấy tờ thật.
