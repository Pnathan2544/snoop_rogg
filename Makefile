.DEFAULT_GOAL := help

COREPACK_DIR ?= .corepack
ifeq ($(OS),Windows_NT)
PNPM ?= $(COREPACK_DIR)\pnpm.CMD
PATH_SEPARATOR := ;
else
PNPM ?= $(COREPACK_DIR)/pnpm
PATH_SEPARATOR := :
endif
export PATH := $(abspath $(COREPACK_DIR))$(PATH_SEPARATOR)$(PATH)

COMPOSE ?= docker compose
DEV_COMPOSE ?= $(COMPOSE) -f docker-compose.dev.yml

DURATION ?= 600
RPS ?= 10
SCENARIO ?= mixed
SEED ?= 42
INTERVAL_MS ?= 1000

.PHONY: help doctor bootstrap-pnpm install dev infra-up infra-down infra-logs stack-up stack-down \
	stack-rebuild status logs health seed seed-local seed-fast lint typecheck test build verify \
	compose-config db-generate db-migrate db-push reset

help:
	@echo Rate Snoop development commands
	@echo.
	@echo Setup and development:
	@echo   make doctor           Check required local tools
	@echo   make bootstrap-pnpm   Create a workspace-local pnpm shim
	@echo   make install          Install locked workspace dependencies
	@echo   make dev              Start infrastructure and local app servers
	@echo   make infra-up         Start PostgreSQL and Redis only
	@echo   make infra-down       Stop development infrastructure
	@echo.
	@echo Full Docker stack:
	@echo   make stack-up         Build and start every service
	@echo   make stack-down       Stop services and preserve data
	@echo   make stack-rebuild    Rebuild and restart every service
	@echo   make status           Show service state
	@echo   make logs             Follow service logs
	@echo   make health           Check API, worker, and dashboard health
	@echo   make reset            Stop services and remove data volumes
	@echo.
	@echo Demo traffic:
	@echo   make seed             Run traffic inside the full Docker stack
	@echo   make seed-local       Run traffic against locally started apps
	@echo   make seed-fast        Run a three-minute mixed demo
	@echo   Variables: DURATION=$(DURATION) RPS=$(RPS) SCENARIO=$(SCENARIO) SEED=$(SEED)
	@echo.
	@echo Quality and database:
	@echo   make verify           Lint, type-check, test, and build
	@echo   make compose-config   Validate production and development Compose files
	@echo   make db-generate      Generate database migrations
	@echo   make db-migrate       Apply database migrations
	@echo   make db-push          Push schema changes directly

doctor:
	make --version
	node --version
	corepack --version
	docker --version
	docker compose version

bootstrap-pnpm:
	node -e "require('fs').mkdirSync('$(COREPACK_DIR)', { recursive: true })"
	corepack enable --install-directory $(COREPACK_DIR) pnpm

install: bootstrap-pnpm
	$(PNPM) install --frozen-lockfile

dev: bootstrap-pnpm infra-up
	$(PNPM) dev

infra-up:
	$(DEV_COMPOSE) up -d

infra-down:
	$(DEV_COMPOSE) down

infra-logs:
	$(DEV_COMPOSE) logs -f --tail=100

stack-up:
	$(COMPOSE) up --build -d

stack-down:
	$(COMPOSE) down

stack-rebuild:
	$(COMPOSE) up --build --force-recreate -d

status:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=100

health:
	node -e "Promise.all(['http://localhost:3001/health/ready','http://localhost:3002/health/ready','http://localhost:3000'].map(async url => { const response = await fetch(url); if (!response.ok) throw new Error(url + ' returned ' + response.status); console.log('OK ' + url); })).catch(error => { console.error(error.message); process.exit(1); })"

seed:
	$(COMPOSE) exec -T api node dist/apps/api/src/scripts/seed-realtime.js --duration $(DURATION) --rps $(RPS) --scenario $(SCENARIO) --seed $(SEED) --interval $(INTERVAL_MS)

seed-local: bootstrap-pnpm
	$(PNPM) --filter @rate-snoop/api seed:realtime -- --duration $(DURATION) --rps $(RPS) --scenario $(SCENARIO) --seed $(SEED) --interval $(INTERVAL_MS)

seed-fast:
	$(MAKE) seed DURATION=180 RPS=20 SCENARIO=mixed SEED=$(SEED)

lint: bootstrap-pnpm
	$(PNPM) lint

typecheck: bootstrap-pnpm
	$(PNPM) type-check

test: bootstrap-pnpm
	$(PNPM) test

build: bootstrap-pnpm
	$(PNPM) build

verify: bootstrap-pnpm
	$(PNPM) verify

compose-config:
	$(COMPOSE) -f docker-compose.yml config --quiet
	$(COMPOSE) -f docker-compose.dev.yml config --quiet

db-generate: bootstrap-pnpm
	$(PNPM) db:generate

db-migrate: bootstrap-pnpm
	$(PNPM) db:migrate

db-push: bootstrap-pnpm
	$(PNPM) db:push

reset:
	$(COMPOSE) down -v
