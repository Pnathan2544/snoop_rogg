.DEFAULT_GOAL := help

PNPM ?= corepack pnpm
COMPOSE ?= docker compose
DEV_COMPOSE ?= $(COMPOSE) -f docker-compose.dev.yml

DURATION ?= 600
RPS ?= 10
SCENARIO ?= mixed
SEED ?= 42
INTERVAL_MS ?= 1000

.PHONY: help doctor install dev infra-up infra-down infra-logs stack-up stack-down \
	stack-rebuild status logs health seed seed-fast lint typecheck test build verify \
	compose-config db-generate db-migrate db-push reset

help:
	@echo Rate Snoop development commands
	@echo.
	@echo Setup and development:
	@echo   make doctor           Check required local tools
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
	@echo   make seed             Run realistic real-time traffic
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
	node --version
	corepack --version
	docker --version
	docker compose version

install:
	$(PNPM) install --frozen-lockfile

dev: infra-up
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

seed-fast:
	$(MAKE) seed DURATION=180 RPS=20 SCENARIO=mixed SEED=$(SEED)

lint:
	$(PNPM) lint

typecheck:
	$(PNPM) type-check

test:
	$(PNPM) test

build:
	$(PNPM) build

verify:
	$(PNPM) verify

compose-config:
	$(COMPOSE) -f docker-compose.yml config --quiet
	$(COMPOSE) -f docker-compose.dev.yml config --quiet

db-generate:
	$(PNPM) db:generate

db-migrate:
	$(PNPM) db:migrate

db-push:
	$(PNPM) db:push

reset:
	$(COMPOSE) down -v
