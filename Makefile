# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
<<<<<<< HEAD
COMPOSE ?= docker compose
.DEFAULT_GOAL := help
.PHONY: help up down logs ps seed test citizen-dev reset-demo rls-test repair-db doctor
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

repair-db: .env ## Khởi tạo/sửa schema và seed trên volume hiện tại; không xóa dữ liệu
	$(COMPOSE) up -d db
	$(COMPOSE) run --rm db-setup
	$(COMPOSE) up -d --build citizen

doctor: .env ## Xem tình trạng kết nối, role, bảng và số lượng thủ tục
	@$(COMPOSE) ps
	@$(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"' < core/db/tests/diagnose.sql
	@echo 'API health: curl -i http://localhost:3000/api/health'
=======

COMPOSE ?= docker compose

.DEFAULT_GOAL := help
.PHONY: help up down logs ps seed test

help: ## Liệt kê các lệnh
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-8s %s\n", $$1, $$2}'

.env:
	@echo "Chưa có tệp .env. Chạy: cp .env.example .env rồi sửa mật khẩu." && exit 1

up: .env ## Dựng và khởi động toàn bộ dịch vụ
	$(COMPOSE) up -d --build

down: ## Dừng dịch vụ (giữ dữ liệu)
	$(COMPOSE) down

logs: ## Xem nhật ký
	$(COMPOSE) logs -f --tail=100

ps: ## Xem trạng thái dịch vụ
	$(COMPOSE) ps

seed: ## Nạp dữ liệu mẫu giả lập (bổ sung ở bản v0.1.0)
	@echo "Chưa có dữ liệu mẫu. Thêm vào core/db/seed/."

test: ## Chạy bộ kiểm thử (bổ sung từ ngày 2)
	@echo "Chưa có kiểm thử. Thêm vào core/tests/."
>>>>>>> origin/feat/citizen-portal-responsive-realtime
