# Kết quả kiểm thử trong môi trường tạo mã — 12/11/2026

| Hạng mục | Kết quả | Giới hạn |
|---|---|---|
| `PYTHONPATH=. pytest -q core/orchestrator/tests` | **10 passed, 1 skipped** | SQLite, API test qua FastAPI TestClient |
| Python `compileall` | Đạt | Kiểm tra cú pháp Python, không phải typecheck |
| Vue `<script setup lang="ts">` | 6 tệp được TypeScript transpile không có lỗi cú pháp | Không tương đương Nuxt build hoặc typecheck Vue template |
| YAML `docker-compose.yml`, APISIX, OpenAPI | Parse thành công bằng PyYAML | Chưa khởi động container |
| PostgreSQL RLS thực | **Chưa chạy** | Test bị skip khi thiếu `PG_TEST_URL` và Docker |
| `npm install`, Nuxt build | **Chưa xác minh** | Không tải được phụ thuộc npm trong môi trường tạo mã |
| Keycloak, APISIX, Flowable, MinIO E2E | **Chưa xác minh** | Không có Docker để chạy Compose và kiểm tra tích hợp |

Những kết quả trên không phải biên bản nghiệm thu hệ thống thực tế hoặc xác nhận sẵn sàng sản xuất.
