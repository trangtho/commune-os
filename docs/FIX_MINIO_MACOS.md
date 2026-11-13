# Khắc phục `pull access denied for minio/minio` trên macOS

## Vì sao lỗi?

Bản Compose cũ khai báo `minio/minio:RELEASE.2024-08-29T01-40-52Z`. Kho image `minio/minio` không còn phát hành trên Docker Hub, vì thế `docker compose up` dừng ở bước tải image. Dòng `Interrupted` tại PostgreSQL/APISIX không tự chứng tỏ hai dịch vụ này có lỗi.

## Bản vá này làm gì?

- Đổi thành `docker.io/pgsty/silo:RELEASE.2026-11-09T00-00-00Z` (bản đã được bên cung cấp công bố cho amd64 và arm64).
- SILO tương thích S3 và nhận `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`.
- **Giữ nguyên** service Compose `minio`, cấu hình `S3_ENDPOINT=http://minio:9000` trong orchestrator, và volume `minio_data`. Không đổi ứng dụng hoặc `.env`.
- Thêm healthcheck `silo healthcheck ready`; orchestrator đợi `service_healthy`.

Nguồn: https://silo.pgsty.com/operations/deployments/baremetal-deploy-minio-as-a-container/ và https://silo.pgsty.com/compatibility/versions/ .

## Cách áp dụng với dự án hiện có trên MacBook

Nếu bạn chỉ tải tệp `docker-compose.yml` đã sửa, hãy đặt tệp này đè lên `commune-os/docker-compose.yml` (bạn có thể sao lưu file cũ trước).
**Không xóa file `.env`, không xóa volume Docker, không chạy `docker compose down -v`.** Nếu bạn giải nén toàn bộ mã nguồn bản sửa vào thư mục mới, hãy tự sao chép file `.env` riêng từ dự án cũ vào dự án mới (file ZIP không chứa khóa riêng).

Mở Terminal trong thư mục `commune-os`:

```bash
docker compose config --quiet
docker compose pull minio
docker compose up -d --build
docker compose ps
```

Kiểm tra riêng kho S3:

```bash
docker compose ps minio
docker compose logs --tail=50 minio
```

Trang giao diện dự kiến: http://localhost:3000 và backend health: http://localhost:8080/health . Nếu image khác báo lỗi sau đó, hãy xem thông báo mới thay vì xóa volume.

## Giới hạn kiểm chứng

Đã kiểm tra cấu trúc YAML, biến môi trường/endpoint/volume và tính nguyên vẹn mã nguồn, nhưng **không có Docker Engine trong môi trường tạo gói**, vì thế chưa thể xác nhận pull/startup hoặc kết quả kiểm thử tích hợp trên máy của bạn.
