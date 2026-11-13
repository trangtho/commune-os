# Cài đặt và kiểm chứng

## 1. Yêu cầu

Docker Engine + Docker Compose plugin. Trên MacBook, nếu image `minio/minio` cũ gặp lỗi `pull access denied`, xem [bản vá SILO](FIX_MINIO_MACOS.md). RAM dự kiến ít nhất 8–16 GB khi bật Keycloak/Flowable, dung lượng disk cho image. Chưa thử trên máy sạch trong phiên tạo mã này.

```bash
cp .env.example .env
# SỬA TOÀN BỘ DB_PASSWORD / DEMO_SECRET / S3_SECRET_KEY / KEYCLOAK_ADMIN_PASSWORD
make up
make ps
```

- Giao diện: http://localhost:3000
- API qua APISIX: http://localhost:8080/health
- OpenAPI: http://localhost:8080/docs
- 6 vai trò demo được chọn ở màn hình đăng nhập; tài khoản giả lập phát JWT nội bộ khi `DEMO_MODE=true`. **Không mở các cổng demo ra Internet.**
- Dữ liệu seed mẫu của **hai xã** chạy một lần khi API khởi động với demo mode; cũng có thể `make seed`.

## 2. Thử nghiệm trên máy cục bộ không có Docker

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r core/orchestrator/requirements.txt pytest
export DATABASE_URL="sqlite:///./commune_demo.db"
export DEMO_MODE=true
export DEMO_SECRET="local_test_secret_replace_me_32_characters"
export STORAGE_MODE=local
export CORS_ORIGINS=http://localhost:3000
PYTHONPATH=. uvicorn core.orchestrator.app.main:app --host 127.0.0.1 --port 8000
```

Terminal thứ hai:

```bash
cd apps/commune
npm install
NUXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev
```

Kết nối npm/Docker registry là điều kiện bắt buộc để tải thư viện, image. Phiên tạo mã này không có điều kiện kiểm chứng cài npm hoàn chỉnh.

## 3. Kiểm thử

```bash
pip install -r core/orchestrator/requirements.txt pytest
make test
# Nếu có PostgreSQL demo khởi động và dữ liệu seed:
PG_TEST_URL='postgresql+psycopg://commune_app:...@localhost:5432/communeos' \
  PYTHONPATH=. pytest -q core/orchestrator/tests/test_postgres_rls.py
```

PostgreSQL không được expose cổng ra host theo Compose mặc định; để chạy PG integration test cần chạy pytest trong cùng mạng Docker hoặc tạo tunnel/cổng cục bộ có kiểm soát. Lệnh PG_TEST_URL ở trên là ví dụ định dạng URL, không phải một kết nối được cấu hình sẵn.

## 4. Tùy chọn Keycloak/Flowable

```bash
# Keycloak chỉ khởi động khi dùng profile identity
make up-identity
# Trên realm communeos: tạo user thử nghiệm, gán realm role,
# đặt attribute tenant_id thành UUID tenant tương ứng.
# Sau đó đổi DEMO_MODE=false trong .env và NUXT_PUBLIC_DEMO_MODE=false.

# Flowable: đổi FLOWABLE_ENABLED=true trong .env, sau đó:
make up-workflow
```

Các UUID tenant mẫu: Thành Phú `11111111-1111-4111-8111-111111111111`; Bình An `22222222-2222-4222-8222-222222222222`. Không đưa mật khẩu thật vào repository. Các service ngoài chưa được kiểm thử E2E.

## 5. Sao lưu

`make backup` sinh `pg_dump` dưới `backups/` (không version-control). Cần sao lưu riêng volume `minio_data`, Keycloak và cấu hình; restore kiểm chứng chưa có. Không dùng bản demo cho dữ liệu thật.
