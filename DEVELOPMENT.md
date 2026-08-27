# Local Development Guide

Everything a new developer needs to run the Stellar Analytics Dashboard on their machine — no tribal knowledge required.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [First-time setup](#2-first-time-setup)
3. [Running services](#3-running-services)
4. [Mock mode (no live Stellar network)](#4-mock-mode-no-live-stellar-network)
5. [Environment variables reference](#5-environment-variables-reference)
6. [Port map](#6-port-map)
7. [Database migrations](#7-database-migrations)
8. [Running tests](#8-running-tests)
9. [Common tasks](#9-common-tasks)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Tool    | Minimum version     | How to check     |
| ------- | ------------------- | ---------------- |
| Node.js | 18 (20 recommended) | `node --version` |
| pnpm    | 9                   | `pnpm --version` |

See [`docs/node-versions.md`](docs/node-versions.md) for the full version policy, CI alignment, and troubleshooting.
| Docker Desktop | any recent | `docker --version` |
| Docker Compose | v2 (bundled with Desktop) | `docker compose version` |
| Git | any | `git --version` |

Install pnpm if missing:

```bash
npm install -g pnpm@9
```

---

## 2. First-time setup

```bash
# 1. Clone
git clone <repo-url>
cd stellar-analytics-dashboard

# 2. Install all workspace dependencies
pnpm install

# 3. Start local infrastructure (Postgres + Redis)
docker compose -f docker-compose.dev.yml up -d postgres redis

# 4. Copy environment files and fill in values
cp indexer/.env.example          indexer/.env
cp packages/api/.env.example     packages/api/.env

# 5. Run database migrations
pnpm db:migrate
```

The `.env.example` files are pre-filled with values that match the dev
Docker Compose configuration, so step 4 works out of the box unless you
changed ports or passwords.

---

## 3. Running services

### All at once (recommended)

```bash
pnpm dev
```

This starts the indexer, API, and frontend concurrently using `concurrently`.
Logs from all three services are colour-coded in the same terminal.

### Individually (useful for focusing on one service)

```bash
# Indexer  (polls Stellar, writes to Postgres)
pnpm dev:indexer

# GraphQL API  (serves the dashboard frontend)
pnpm dev:api

# Frontend  (Vite dev server with HMR)
pnpm dev:frontend
```

### Startup order

The services are independent but follow this dependency chain:

```
Postgres + Redis  →  Indexer  →  API  →  Frontend
```

The API and Frontend start fine before the Indexer has ingested data — they
will show empty state until the Indexer writes its first ledger.

---

## 4. Mock mode (no live Stellar network)

By default the indexer connects to the live Stellar Horizon API. During
feature development you often don't need real blockchain data and don't want
to depend on network availability or rate limits.

**Enable mock mode** with a single environment variable:

```bash
# indexer/.env
STELLAR_MOCK=true
```

Or inline for a single run:

```bash
STELLAR_MOCK=true pnpm dev:indexer
```

### What mock mode does

- Replaces all `Horizon.Server` calls with a deterministic in-process generator.
- Produces realistic-looking ledger, transaction, and operation records.
- Sequence numbers increment on every poll, just like a live network.
- No network calls, no Horizon account required, works fully offline.
- Writes data to Postgres just like normal — the API and frontend are unaffected.

See [`docs/mock-data-limitations.md`](docs/mock-data-limitations.md) for full details on mock limitations, supported operation types, synthetic accounts, and simulation boundaries.

### How it works internally

`indexer/src/mock-horizon.ts` exports `createMockHorizonServer()`, a factory
that returns an object matching the `HorizonServerLike` interface.
`ingester.ts` resolves which server to use at runtime via the `resolveServer()`
helper, checked in this order:

1. `serverOverride` argument (used in unit tests)
2. `STELLAR_MOCK=true` env var → singleton mock
3. Real `Horizon.Server` connected to the configured network

This means **unit tests never touch the network at all** — they pass a mock
directly without setting any env var.

### Running offline unit tests

```bash
# From repo root
pnpm --filter @stellar-analytics/indexer test

# Or from the indexer folder
cd indexer
pnpm test
```

The `ingester.mock.test.ts` suite covers:

- Shape validation of `IngestedData`
- Consecutive poll sequence increments
- `fetchLedger` and `fetchLedgerRange` helpers
- Full transformer pipeline compatibility
- `STELLAR_MOCK=true` env-driven path

These tests are fast (~< 1 s) and require no Docker or network.

---

## 5. Environment variables reference

### Indexer (`indexer/.env`)

```dotenv
# ── Network ────────────────────────────────────────────────────────────────
STELLAR_NETWORK=testnet          # testnet | mainnet
STELLAR_MOCK=false               # true = use built-in mock, no network calls

# ── Database ───────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://stellar_user:stellar_password@localhost:5432/stellar_analytics_dev

# ── Polling ────────────────────────────────────────────────────────────────
POLL_INTERVAL_MS=5000            # How often to poll Horizon (ms)

# ── Ports ──────────────────────────────────────────────────────────────────
HEALTH_PORT=3001                 # Indexer health-check endpoint
WS_PORT=8080                     # WebSocket broadcast server

# ── Logging ────────────────────────────────────────────────────────────────
LOG_LEVEL=info                   # trace | debug | info | warn | error | fatal
LOG_PRETTY=true                  # Human-readable output in dev

# ── Backfill (optional) ────────────────────────────────────────────────────
BACKFILL_CONCURRENCY=4
BACKFILL_BATCH_SIZE=10
BACKFILL_BATCH_DELAY_MS=200
```

The full list with documentation for every variable is in
`indexer/.env.example`.

### API (`packages/api/.env`)

```dotenv
DATABASE_URL=postgresql://stellar_user:stellar_password@localhost:5432/stellar_analytics_dev
REDIS_URL=redis://localhost:6379
PORT=4000
NODE_ENV=development
CORS_ORIGIN=*
JWT_SECRET=dev-secret-change-in-production-minimum-32-chars
LOG_LEVEL=info
```

The full list is in `packages/api/.env.example`.

### Frontend (Vite)

Create `frontend/.env.local` if you need to override defaults:

```dotenv
VITE_GRAPHQL_URL=http://localhost:4000/graphql   # default
VITE_STELLAR_NETWORK=testnet                      # displayed in the UI
```

The frontend has sensible defaults; no `.env` file is needed for local dev
unless you change the API port.

---

## 6. Port map

| Service                         | Port | URL                           |
| ------------------------------- | ---- | ----------------------------- |
| Frontend (Vite HMR)             | 5173 | http://localhost:5173         |
| GraphQL API + Playground        | 4000 | http://localhost:4000/graphql |
| GraphQL WebSocket subscriptions | 4000 | ws://localhost:4000/graphql   |
| Indexer health check            | 3001 | http://localhost:3001/health  |
| Indexer readiness probe         | 3001 | http://localhost:3001/ready   |
| Indexer WebSocket broadcast     | 8080 | ws://localhost:8080           |
| PostgreSQL                      | 5432 | localhost:5432                |
| Redis                           | 6379 | localhost:6379                |

---

## 7. Database migrations

Migrations are managed with `node-pg-migrate` and live in
`packages/indexer/migrations/`.

```bash
# Apply all pending migrations
pnpm db:migrate

# Roll back the last migration
pnpm db:migrate:down

# Create a new migration file
pnpm db:migrate:create describe_your_change
```

To fully reset the dev database:

```bash
docker compose -f docker-compose.dev.yml down -v   # removes volumes
docker compose -f docker-compose.dev.yml up -d postgres redis
pnpm db:migrate
```

See `docs/database-migrations.md` for rollback and CI guidance.

---

## 8. Running tests

### All tests (unit + integration)

```bash
pnpm test:ci
```

### By package

```bash
# Indexer unit tests (includes offline mock tests — no network required)
pnpm --filter @stellar-analytics/indexer test

# API unit tests
pnpm --filter @stellar-analytics/api test

# Frontend unit tests (Vitest)
pnpm --filter @stellar-analytics/frontend test:ci
```

### E2E tests (requires running stack)

```bash
# Headless
pnpm test:e2e

# With Playwright UI
pnpm test:e2e:ui

# Single browser
pnpm test:e2e:chrome
pnpm test:e2e:firefox
pnpm test:e2e:webkit
```

E2E tests spin up their own Postgres and Redis via Docker — you don't need
the dev compose stack running separately.

### Indexer tests — live vs mock

| Test file               | Needs network?    | Needs DB? |
| ----------------------- | ----------------- | --------- |
| `ingester.mock.test.ts` | **No**            | No        |
| `ingester.test.ts`      | **Yes** (testnet) | No        |
| `config.test.ts`        | No                | No        |

Run only the offline tests with:

```bash
cd indexer
pnpm test -- --testPathPattern="mock"
```

---

## 9. Common tasks

### Check if all services are healthy

```bash
# Indexer
curl http://localhost:3001/health

# API
curl http://localhost:4000/health

# Postgres (via Docker)
docker compose -f docker-compose.dev.yml exec postgres pg_isready -U stellar_user
```

### Trigger a manual backfill

```bash
# Backfill from ledger 1000000 to latest
curl -X POST http://localhost:3001/backfill \
  -H "Content-Type: application/json" \
  -d '{"startSequence": 1000000}'
```

### Open the GraphQL Playground

Navigate to http://localhost:4000/graphql in your browser. The playground is
enabled automatically in development (`NODE_ENV !== 'production'`).

### Wipe and reseed local data

```bash
# Reset the database volume and re-migrate
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d postgres redis
pnpm db:migrate

# Then start the indexer (or use mock mode) to repopulate
STELLAR_MOCK=true pnpm dev:indexer
```

### Lint and format

```bash
pnpm lint          # check
pnpm lint:fix      # auto-fix
pnpm format        # prettier
```

---

## 10. Troubleshooting

### `pnpm install` fails with workspace errors

Make sure you are at the repo root (where `pnpm-workspace.yaml` is) and that
your pnpm version is ≥ 9:

```bash
pnpm --version
# if < 9:
npm install -g pnpm@9
```

### `pnpm db:migrate` fails: "connection refused"

Postgres isn't running. Start it:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
```

Then verify:

```bash
docker compose -f docker-compose.dev.yml ps
```

### Indexer exits with "Missing required environment variables"

Copy the example file and verify the values match your Docker Compose config:

```bash
cp indexer/.env.example indexer/.env
```

The defaults in `.env.example` are pre-configured for the dev compose stack.

### API exits with "Missing required environment variables"

```bash
cp packages/api/.env.example packages/api/.env
```

### Frontend shows "Network error" or blank dashboard

1. Confirm the API is running: `curl http://localhost:4000/graphql`
2. Check `VITE_GRAPHQL_URL` in `frontend/.env.local` (defaults to `http://localhost:4000/graphql`)
3. Look at the browser console for the actual Apollo error

### Port already in use

Check what is using the port and stop it, or change the port in `.env`:

```bash
# Windows
netstat -ano | findstr :<PORT>
taskkill /PID <PID> /F

# macOS / Linux
lsof -i :<PORT>
kill <PID>
```

### `STELLAR_MOCK=true` but no data appears in the frontend

The mock writes data to Postgres just like real data. Verify:

1. Postgres is running (`docker compose -f docker-compose.dev.yml ps`)
2. Migrations have been applied (`pnpm db:migrate`)
3. The indexer log shows `[indexer] processed ledger <N>`
4. The API is running and can reach Postgres (`curl http://localhost:4000/health`)

### Docker Compose: `Error response from daemon: network not found`

```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d
```

### Tests fail with "Cannot find module '../src/logger.js'"

Run `pnpm install` from the repo root to ensure all workspace symlinks are
resolved.

---

## Further reading

| Document                             | What it covers                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `CONTRIBUTING.md`                    | Branch strategy, commit conventions, PR checklist                       |
| `docs/node-versions.md`              | Supported Node.js and pnpm versions                                     |
| `CACHING.md`                         | Redis TTL strategy and cache-aside pattern                              |
| `docs/database-migrations.md`        | Migration workflow, rollback, CI                                        |
| `docs/query-performance.md`          | Indexes, slow-query monitoring, DataLoader                              |
| `docs/error-handling-and-logging.md` | Winston config, log levels, error codes                                 |
| `docs/security-headers.md`           | Helmet configuration                                                    |
| `docs/cors.md`                       | CORS setup for multi-origin deployments                                 |
| `indexer/ALERTING.md`                | Slack / email alert configuration                                       |
| `indexer/BACKFILL.md`                | Backfill CLI reference                                                  |
| `docs/mock-data-limitations.md`      | Horizon simulation boundaries, synthetic accounts, and mock limitations |
