# Changelog

## v0.3.0-demo+minio-fix — 2026-11-12
- Sửa Docker Compose: đổi image `minio/minio` không thể pull sang `docker.io/pgsty/silo:RELEASE.2026-11-09T00-00-00Z` (S3-compatible, amd64/arm64).
- Giữ service `minio`, endpoint `http://minio:9000`, biến đăng nhập, volume `minio_data`, không cần đổi `.env`.
- Thêm healthcheck SILO và chỉ khởi động orchestrator sau khi kho S3 sẵn sàng.
- Bổ sung tài liệu sửa lỗi trên macOS. Chưa kiểm thử Docker end-to-end trong môi trường tạo bản vá.

## v0.3.0-demo — 2026-11-12
- Khởi tạo monorepo từ README đặc tả và Word danh mục 60 chức năng.
- Nuxt UI thống nhất cho 6 vai trò.
- FastAPI, PostgreSQL schema/RLS, sổ cái, thử nghiệm API cục bộ.
- Ba gói thủ tục giả lập, Compose/APISIX/MinIO, cấu hình Keycloak/Flowable tùy chọn.
- Ma trận yêu cầu trung thực về tiến độ.

**Chưa phát hành v1.0.0; chưa có bằng chứng nghiệm thu thực địa.**
