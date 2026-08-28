# Stellar Analytics Dashboard

Monorepo scaffold for a Stellar blockchain analytics platform with a data pipeline, GraphQL API, React dashboard, and shared TypeScript package.

## Project Structure

```text
.
+-- indexer/                  # Indexer service (runtime)
|   +-- src/
|       +-- ingester.ts
|       +-- transformer.ts
|       +-- loader.ts
|       +-- websocket.ts
|       +-- index.ts
|       +-- database/schema.sql
+-- packages/
|   +-- api/                  # GraphQL API server
|   |   +-- src/
|   |       +-- schema.ts
|   |       +-- resolvers/
|   |       +-- index.ts
|   +-- e2e/                  # End-to-end tests
|   +-- indexer/
|       +-- migrations/       # SQL migrations
+-- frontend/                 # React dashboard (Vite)
|   +-- src/
|       +-- components/
|       +-- hooks/
|       +-- pages/
|       +-- App.tsx
|       +-- main.tsx
+-- shared/                   # Shared types and utilities
|   +-- src/
|       +-- config/networks.ts
|       +-- types/
|       +-- utils/
+-- docker-compose.yml
+-- package.json
+-- pnpm-workspace.yaml
```

See [`docs/architecture.md`](./docs/architecture.md) for the full path map and system diagrams.

## Stellar Network Config

Shared network configuration is in `shared/src/config/networks.ts`:
- `mainnet` Horizon: `https://horizon.stellar.org`
- `testnet` Horizon: `https://horizon-testnet.stellar.org`

## Database Schema

`indexer/src/database/schema.sql` initializes these tables:
- `blocks`
- `transactions`
- `operations`
- `ledgers`

## Local Setup

> **New to the project?** See [DEVELOPMENT.md](./DEVELOPMENT.md) for a complete step-by-step guide covering prerequisites, environment variables, mock mode, port map, and troubleshooting.

1. Install dependencies:

```bash
pnpm install
```

2. Start PostgreSQL and Redis:

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
```

3. Copy and configure environment files (see [`docs/environment-variables.md`](./docs/environment-variables.md) for the full reference):

```bash
cp indexer/.env.example       indexer/.env
cp packages/api/.env.example  packages/api/.env
```

4. Run migrations:

```bash
pnpm db:migrate
```

5. Start all services:

```bash
pnpm dev
```

### Mock mode (no Stellar network required)

Set `STELLAR_MOCK=true` in `indexer/.env` to run the indexer fully offline
using deterministic generated data. See [DEVELOPMENT.md § Mock mode](./DEVELOPMENT.md#4-mock-mode-no-live-stellar-network) for details.

### CI/CD

This repository includes GitHub Actions workflows for:
- PR validation with lint and build checks
- automated E2E testing for feature branches
- staging and production container deployment pipelines
- manual rollback via workflow dispatch

Backups are automated by the `postgres-backup` service when running full compose (`docker compose up -d`), and you can run backup operations manually:

```bash
pnpm backup:run
pnpm backup:verify
pnpm backup:health
```

3. Run services in separate terminals:

```bash
pnpm --filter @stellar-analytics/indexer dev
pnpm --filter @stellar-analytics/api dev
pnpm --filter @stellar-analytics/frontend dev
```

## Endpoints

- API GraphQL + playground: `http://localhost:4000/graphql`
- Frontend (Vite): `http://localhost:5173`

## API Examples

Ready-to-run GraphQL examples for the **dashboard**, **account** and
**network analytics** endpoint families (with cURL invocations and
expected responses) live in [`docs/api-examples.md`](docs/api-examples.md).

See also:

- [`docs/graphql-query-standards.md`](docs/graphql-query-standards.md) — naming & linting rules
- [`docs/graphql-query-limits.md`](docs/graphql-query-limits.md) — depth and complexity limits
- [`docs/query-performance.md`](docs/query-performance.md) — DataLoader batching & slow-query monitoring


## Database Migrations

Schema changes are managed with `node-pg-migrate`:

```bash
pnpm db:migrate
pnpm db:migrate:down
```

See `docs/database-migrations.md` for the full migration workflow.

## Query Performance

Slow-query monitoring, DataLoader batching, Redis caching, and index review guidance are documented in `docs/query-performance.md`.

## Backup and Disaster Recovery

Backup/restore/PITR runbook is documented in `docs/backup-disaster-recovery.md`.

## Code Ownership

Each service area has a designated owning team that is automatically requested for review on relevant PRs.

See `docs/code-ownership.md` for the ownership table, per-area acceptance criteria, and escalation guidelines.

## Dependency Management

Third-party packages are updated automatically each week via Dependabot. Security advisories are handled immediately.

See `docs/dependency-management.md` for the full update policy and review checklist.
