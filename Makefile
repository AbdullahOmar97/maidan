# =============================================================================
# MAIDAN Dojo Management System — Makefile
# =============================================================================

.PHONY: help up down build logs shell-backend shell-frontend migrate makemigrations createsuperuser seed test lint format

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Dev Environment ---
up: ## Start all services (dev)
	docker compose up -d

down: ## Stop all services
	docker compose down

build: ## Build all Docker images
	docker compose build

logs: ## Tail logs from all services
	docker compose logs -f

logs-backend: ## Tail backend logs only
	docker compose logs -f backend

logs-frontend: ## Tail frontend logs only
	docker compose logs -f frontend

# --- Shell Access ---
shell-backend: ## Django shell
	docker compose exec backend python manage.py shell_plus

shell-db: ## PostgreSQL shell
	docker compose exec db psql -U maidan_user -d maidan

shell-redis: ## Redis CLI
	docker compose exec redis redis-cli

# --- Django Management ---
migrate: ## Run Django migrations
	docker compose exec backend python manage.py migrate_schemas --shared
	docker compose exec backend python manage.py migrate_schemas

makemigrations: ## Make Django migrations
	docker compose exec backend python manage.py makemigrations

createsuperuser: ## Create Django superuser
	docker compose exec backend python manage.py createsuperuser

seed: ## Seed demo data
	docker compose exec backend python manage.py seed_demo

collectstatic: ## Collect static files
	docker compose exec backend python manage.py collectstatic --noinput

# --- Testing ---
test-backend: ## Run backend tests
	docker compose exec backend python manage.py test --verbosity=2

test-frontend: ## Run frontend tests
	docker compose exec frontend pnpm test

test: test-backend test-frontend ## Run all tests

# --- Code Quality ---
lint-backend: ## Lint backend (flake8 + isort)
	docker compose exec backend flake8 .
	docker compose exec backend isort --check-only .

lint-frontend: ## Lint frontend (eslint)
	docker compose exec frontend pnpm lint

format-backend: ## Format backend (black + isort)
	docker compose exec backend black .
	docker compose exec backend isort .

format-frontend: ## Format frontend (prettier)
	docker compose exec frontend pnpm format

# --- Production ---
up-prod: ## Start production services
	docker compose -f docker-compose.prod.yml up -d

down-prod: ## Stop production services
	docker compose -f docker-compose.prod.yml down

build-prod: ## Build production images
	docker compose -f docker-compose.prod.yml build

# --- Database ---
db-backup: ## Backup PostgreSQL
	docker compose exec db pg_dump -U maidan_user maidan > backups/maidan_$(shell date +%Y%m%d_%H%M%S).sql

db-restore: ## Restore PostgreSQL (usage: make db-restore FILE=backups/file.sql)
	docker compose exec -T db psql -U maidan_user maidan < $(FILE)

# --- Tenant Management ---
create-tenant: ## Create a tenant (usage: make create-tenant NAME=dojo1 DOMAIN=dojo1.maidan.app)
	docker compose exec backend python manage.py create_tenant --name=$(NAME) --domain=$(DOMAIN)
