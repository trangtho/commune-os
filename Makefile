# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0

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
