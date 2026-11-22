# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
COMPOSE ?= docker compose
.DEFAULT_GOAL := help
.PHONY: citizen-api-test procedure-privacy-test help up down logs ps seed test test-citizen citizen-dev reset-demo rls-test rag-test chat-history-test personalization-test representation-test citizen-experience-test handoff-support-test guidance-batches-test preflight-counter-test repair-db doctor
help: ## Liệt kê lệnh
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-14s %s\n", $$1, $$2}'
.env:
	@echo "Thiếu .env. Chạy cp .env.example .env và đổi các mật khẩu trước." && exit 1
up: .env ## Dựng và khởi động toàn bộ dịch vụ, tự nạp schema, dữ liệu mẫu và mô hình AI (lần đầu)
	$(COMPOSE) up -d --build
	@# Tệp cấu hình cổng gắn từng tệp vào container: git pull thay tệp mới thì container vẫn giữ tệp cũ.
	$(COMPOSE) up -d --force-recreate --no-deps gateway

down: ## Dừng dịch vụ nhưng không xóa dữ liệu
	$(COMPOSE) down

logs: ## Xem nhật ký dịch vụ
	$(COMPOSE) logs -f --tail=100

ps: ## Xem tình trạng dịch vụ
	$(COMPOSE) ps

seed: .env ## Nạp lại dữ liệu mẫu (idempotent)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/seed/seed.sql

test: .env ## Kiểm thử cách ly xã qua gateway (cần docker compose up)
	sh core/tests/tenant-isolation.sh

test-citizen: ## Kiểm thử đơn vị Kênh người dân (chạy trong Node 22 chính thức)
	docker run --rm -v "$(CURDIR)":/w -w /w/apps/citizen node:22-alpine npm test

citizen-dev: ## Chạy Nuxt dev; cần export PG*, SESSION_SECRET theo tài liệu
	cd apps/citizen && npm run dev

reset-demo: ## XÓA TOÀN BỘ dữ liệu PostgreSQL và tệp thử nghiệm (cần xác nhận khi sử dụng)
	@echo 'Lệnh này có thể XÓA toàn bộ dữ liệu. Hãy chạy thủ công: docker compose down -v'

rls-test: .env ## Thử RLS 2 công dân / 2 xã (cần PostgreSQL)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-rls.sql

rag-test: .env ## Kiểm thử tự động cập nhật kho AI RAG (ROLLBACK; giữ nguyên dữ liệu)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-rag.sql

chat-history-test: .env ## Kiểm thử RLS và xóa lịch sử 2 tài khoản (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-chat-history.sql

personalization-test: .env ## Kiểm thử phân quyền và tuyến tiếp nhận công dân (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-personalization.sql

representation-test: .env ## Kiểm thử phân quyền đại diện và phiên tại quầy (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-representation-counter.sql

citizen-experience-test: .env ## Kiểm thử quyền truy cập lịch tư vấn và đánh giá (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-access-family-consultation.sql

handoff-support-test: .env ## Kiểm tra mã chuyển tiếp dùng một lần và bảo vệ dữ liệu hỗ trợ (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-handoff-support.sql

guidance-batches-test: .env ## Kiểm tra RLS nhóm hồ sơ và quyền cấu hình quy tắc gợi ý (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-guidance-batches.sql

preflight-counter-test: .env ## Kiểm tra số thứ tự và phân quyền yêu cầu bổ sung (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-preflight-counter-supplement.sql

case-actions-test: .env ## Kiểm tra quyền xem xét, nhận kết quả và chuyển cơ quan (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-case-actions-delivery-routing.sql

vault-autofill-test: .env ## Kiểm thử RLS kho giấy tờ và tự điền (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-vault-autofill.sql

procedure-privacy-test: .env ## Kiểm thử RLS, nhật ký và thay đổi phiên bản thủ tục (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-procedure-privacy.sql

life-journey-test: .env ## Kiểm thử lộ trình, lịch và phân quyền (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-life-journeys.sql

intelligent-services-test: .env ## Kiểm tra bảo vệ dữ liệu, mã kết quả và đồng bộ (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-intelligent-services.sql

citizen-api-test: .env ## Kiểm thử API luồng chính của công dân trong lõi: nộp hồ sơ, Poka-yoke, RLS (ROLLBACK)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/citizen-core-api.sql

repair-db: .env ## Khởi tạo/sửa schema và seed trên volume hiện tại; không xóa dữ liệu
	$(COMPOSE) up -d db
	$(COMPOSE) run --rm db-setup
	$(COMPOSE) up -d --build citizen

doctor: .env ## Xem tình trạng kết nối, role, bảng và số lượng thủ tục
	@$(COMPOSE) ps
	@$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/diagnose.sql
	@echo 'API health: curl -i http://localhost:3000/api/health'
