# SPDX-License-Identifier: Apache-2.0
PYTHON ?= python3
.DEFAULT_GOAL := help
.PHONY: help up down ps logs test seed backup up-identity up-workflow
help:
	@echo "make up  | down | ps | logs | seed | test | backup | up-identity | up-workflow"
up:
	docker compose up -d --build
up-identity:
	docker compose --profile identity up -d --build
up-workflow:
	@echo "Ensure FLOWABLE_ENABLED=true in .env and review Flowable credentials."
	docker compose --profile workflow up -d --build
ps:
	docker compose ps
down:
	docker compose down
logs:
	docker compose logs --tail=100 -f
seed:
	docker compose exec -T orchestrator python -m core.orchestrator.app.cli seed
test:
	PYTHONPATH=. $(PYTHON) -m pytest -q core/orchestrator/tests
backup:
	mkdir -p backups
	@echo "Database SQL dump only; also back up minio_data volume for full restore."
	docker compose exec -T db pg_dump -U commune_app communeos > backups/communeos-$$(date +%Y%m%d-%H%M%S).sql
