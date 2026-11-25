# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
COMPOSE ?= docker compose
.DEFAULT_GOAL := help
.PHONY: check-env demo ready e2e-citizen test-sql backup restore citizen-api-test procedure-privacy-test help up down logs ps seed test test-citizen citizen-dev reset-demo rls-test rag-test chat-history-test personalization-test representation-test citizen-experience-test handoff-support-test guidance-batches-test preflight-counter-test repair-db doctor
help: ## Liệt kê lệnh
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-14s %s\n", $$1, $$2}'
.env:
	@echo "Thiếu .env. Chạy cp .env.example .env và đổi các mật khẩu trước." && exit 1
check-env: .env ## Kiểm tra .env có đủ biến bắt buộc (biến docker-compose.yml dùng mà không có giá trị mặc định)
	@# .env tạo từ bản cũ có thể thiếu biến mới thêm; để trống thì dịch vụ vẫn chạy nhưng đăng nhập, gọi API lỗi khó hiểu.
	@missing=""; for k in $$(grep -oE '[$$][{][A-Z_]+[}]' docker-compose.yml | tr -d '$$' | tr -d '{}' | sort -u); do \
	  grep -qE "^$$k=.+" .env || missing="$$missing $$k"; done; \
	if [ -n "$$missing" ]; then \
	  echo "Tệp .env thiếu hoặc để trống các biến bắt buộc:$$missing"; \
	  echo "Chép các dòng tương ứng từ .env.example sang .env (đổi giá trị bí mật), rồi chạy lại."; exit 1; fi
	@sh core/identity/check-admin-env.sh .env
up: check-env ## Dựng và khởi động toàn bộ dịch vụ, tự nạp schema, danh mục thủ tục và mô hình AI (lần đầu); dữ liệu mẫu: make demo
	$(COMPOSE) up -d --build
	@# Cổng API và các dịch vụ Node của lõi chạy thẳng mã nguồn gắn từ core/ vào container: sau git pull, compose
	@# thấy cấu hình không đổi nên không khởi động lại, container vẫn chạy mã cũ (thiếu API mới, đăng nhập, nộp hồ sơ lỗi).
	$(COMPOSE) up -d --force-recreate --no-deps gateway orchestrator accounts files ai-gateway
	@sh core/tests/wait-ready.sh 900

ready: ## Chờ mọi dịch vụ sẵn sàng (healthcheck đạt, các bước khởi tạo đã xong); báo dịch vụ lỗi nếu có
	@sh core/tests/wait-ready.sh 900

demo: check-env ## Tạo 2 xã mẫu, lãnh đạo, cán bộ, công dân và hồ sơ mẫu qua API của lõi (chạy lại được; mật khẩu DEMO_PASSWORD, mặc định Demo@2026!)
	$(COMPOSE) run --rm --no-deps -e DEMO_PASSWORD -v "$(CURDIR)/core/demo:/demo:ro" identity-setup node /demo/demo.mjs
	$(COMPOSE) exec -T db sh -c 'psql -q -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/demo/demo-data.sql

down: ## Dừng dịch vụ nhưng không xóa dữ liệu
	$(COMPOSE) down

logs: ## Xem nhật ký dịch vụ
	$(COMPOSE) logs -f --tail=100

ps: ## Xem tình trạng dịch vụ
	$(COMPOSE) ps

seed: .env ## Nạp lại danh mục thủ tục mẫu (idempotent)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/seed/seed.sql

test: demo ## Kiểm thử cách ly xã qua gateway (cần docker compose up; tự chạy make demo trước)
	sh core/tests/tenant-isolation.sh

test-citizen: ## Kiểm thử đơn vị Kênh người dân (chạy trong Node 22 chính thức)
	docker run --rm -v "$(CURDIR)":/w -w /w/apps/citizen node:22-alpine npm test

e2e-citizen: demo ## Kiểm thử giao diện Kênh người dân bằng Playwright trong Docker (cần make up; tạo dữ liệu trên tài khoản mẫu)
	sh apps/citizen/e2e/run.sh

test-sql: rls-test rag-test chat-history-test personalization-test representation-test citizen-experience-test handoff-support-test guidance-batches-test preflight-counter-test case-actions-test vault-autofill-test procedure-privacy-test life-journey-test intelligent-services-test citizen-api-test ## Chạy mọi bài kiểm thử SQL (RLS, phân quyền; ROLLBACK)

citizen-dev: ## Chạy Nuxt dev; cần export PG*, SESSION_SECRET theo tài liệu
	cd apps/citizen && npm run dev

reset-demo: ## XÓA TOÀN BỘ dữ liệu PostgreSQL và tệp thử nghiệm (cần xác nhận khi sử dụng)
	@echo 'Lệnh này có thể XÓA toàn bộ dữ liệu. Hãy chạy thủ công: docker compose down -v'

rls-test: demo ## Thử RLS 2 công dân / 2 xã (cần PostgreSQL)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-rls.sql

rag-test: .env ## Kiểm thử tự động cập nhật kho AI RAG (ROLLBACK; giữ nguyên dữ liệu)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-rag.sql

chat-history-test: demo ## Kiểm thử RLS và xóa lịch sử 2 tài khoản (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-chat-history.sql

personalization-test: demo ## Kiểm thử phân quyền và tuyến tiếp nhận công dân (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-personalization.sql

representation-test: demo ## Kiểm thử phân quyền đại diện và phiên tại quầy (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-representation-counter.sql

citizen-experience-test: demo ## Kiểm thử quyền truy cập lịch tư vấn và đánh giá (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-access-family-consultation.sql

handoff-support-test: demo ## Kiểm tra mã chuyển tiếp dùng một lần và bảo vệ dữ liệu hỗ trợ (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-handoff-support.sql

guidance-batches-test: demo ## Kiểm tra RLS nhóm hồ sơ và quyền cấu hình quy tắc gợi ý (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-guidance-batches.sql

preflight-counter-test: demo ## Kiểm tra số thứ tự và phân quyền yêu cầu bổ sung (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-preflight-counter-supplement.sql

case-actions-test: demo ## Kiểm tra quyền xem xét, nhận kết quả và chuyển cơ quan (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-case-actions-delivery-routing.sql

vault-autofill-test: demo ## Kiểm thử RLS kho giấy tờ và tự điền (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-vault-autofill.sql

procedure-privacy-test: demo ## Kiểm thử RLS, nhật ký và thay đổi phiên bản thủ tục (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-procedure-privacy.sql

life-journey-test: demo ## Kiểm thử lộ trình, lịch và phân quyền (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-life-journeys.sql

intelligent-services-test: demo ## Kiểm tra bảo vệ dữ liệu, mã kết quả và đồng bộ (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-intelligent-services.sql

citizen-api-test: demo ## Kiểm thử API luồng chính của công dân trong lõi: nộp hồ sơ, Poka-yoke, RLS (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-core-api.sql

backup: .env ## Sao lưu cơ sở dữ liệu và kho tệp vào backups/<ngày-giờ>/ (có mã băm SHA-256)
	sh core/backup/backup.sh

restore: .env ## Khôi phục từ bản sao lưu, GHI ĐÈ dữ liệu hiện tại: make restore BACKUP=backups/<ngày-giờ>
	sh core/backup/restore.sh "$(BACKUP)"

repair-db: .env ## Khởi tạo/sửa schema và seed trên volume hiện tại; không xóa dữ liệu
	$(COMPOSE) up -d db
	$(COMPOSE) run --rm db-setup
	$(COMPOSE) up -d --build citizen

doctor: .env ## Xem tình trạng kết nối, role, bảng và số lượng thủ tục
	@$(COMPOSE) ps
	@$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/diagnose.sql
	@echo 'API health: curl -i http://localhost:3000/api/health'
