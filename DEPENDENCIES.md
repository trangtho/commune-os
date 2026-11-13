# Danh mục phụ thuộc — cần đối chiếu trước release

Bảng ghi **phiên bản khai báo**, không tuyên bố đã khóa digest hoặc xác minh tương thích giấy phép.

| Thành phần | Khai báo | Trạng thái |
|---|---|---|
| Python FastAPI | `>=0.115,<1` | `core/orchestrator/requirements.txt` |
| SQLAlchemy | `>=2,<3` | Chưa khóa hash |
| PyJWT | `>=2.9,<3` | JWT RS256/HS256 demo |
| Nuxt | `^3.17.0` | `apps/commune/package.json`, chưa có lockfile |
| Vue | `^3.5.0` | Chưa build xác minh |
| Keycloak | `26.0.5` | Profile tùy chọn |
| Apache APISIX | `3.17.0-debian` | Gateway YAML |
| PostgreSQL | `16-alpine` | DB mẫu |
| SILO (nhánh MinIO tương thích S3) | `docker.io/pgsty/silo:RELEASE.2026-11-09T00-00-00Z` | Thay image `minio/minio` không còn tải được; giữ API S3/biến MINIO_*; bản amd64/arm64, cần rà soát giấy phép trước phát hành |
| Flowable REST | `6.8.0` | Profile tùy chọn, chưa nghiệm thu |

**Trước phát hành:** khóa package lock/hash image, đối chiếu giấy phép và nguồn tại phiên bản đúng, tạo SBOM, kiểm thử trên máy sạch. Mã tự viết trong repo có `LICENSE` Apache-2.0; phụ thuộc ngoài giữ giấy phép riêng.
