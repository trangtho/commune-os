# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
COMPOSE ?= docker compose
.DEFAULT_GOAL := help
.PHONY: help up down logs ps seed test citizen-dev reset-demo rls-test rag-test chat-history-test repair-db doctor
help: ## Liệt kê lệnh
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-14s %s\n", $$1, $$2}'
.env:
	@echo "Thiếu .env. Chạy cp .env.example .env và đổi các mật khẩu trước." && exit 1
up: .env ## Khởi động PostgreSQL, tự nạp schema/seed, rồi chạy Công dân
	$(COMPOSE) up -d --build

down: ## Dừng dịch vụ nhưng không xóa dữ liệu
	$(COMPOSE) down

logs: ## Xem nhật ký dịch vụ
	$(COMPOSE) logs -f --tail=100

ps: ## Xem tình trạng dịch vụ
	$(COMPOSE) ps

seed: .env ## Nạp lại dữ liệu mẫu (idempotent)
	$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/seed/seed.sql

test: ## Kiểm tra cấu trúc dự án; không thay thế kiểm thử tích hợp
	cd apps/citizen && npm test

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

repair-db: .env ## Khởi tạo/sửa schema và seed trên volume hiện tại; không xóa dữ liệu
	$(COMPOSE) up -d db
	$(COMPOSE) run --rm db-setup
	$(COMPOSE) up -d --build citizen

doctor: .env ## Xem tình trạng kết nối, role, bảng và số lượng thủ tục
	@$(COMPOSE) ps
	@$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/diagnose.sql
	@echo 'API health: curl -i http://localhost:3000/api/health'
