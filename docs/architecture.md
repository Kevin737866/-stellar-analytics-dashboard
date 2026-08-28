# Architecture Overview

System architecture and canonical package paths for the Stellar Analytics Dashboard monorepo.

**Workspace authority:** `pnpm-workspace.yaml`

---

## Canonical Package .

The monorepo uses a mixed layout. Always use these paths when editing code or documentation:

| Package | Canonical path | pnpm filter | Notes |
|---------|---------------|-------------|-------|
| Indexer (runtime) | `indexer/` | `@stellar-analytics/indexer` | Active source and `.env` |
| Indexer migrations | `packages/indexer/migrations/` | — | SQL migrations (not in workspace) |
| GraphQL API | `packages/api/` | `@stellar-analytics/api` | |
| Frontend (dev) | `frontend/` | `@stellar-analytics/frontend` | Vite dev server |
| Shared types | `shared/` | `@stellar-analytics/shared` | |
| E2E tests | `packages/e2e/` | `@stellar-analytics/e2e` | Playwright |
| ESLint rules | `tools/eslint-rules/` | `@stellar-analytics/eslint-plugin` | |

**Legacy duplicates (do not use for new work):**

| Path | Status |
|------|--------|
| `api/` | Legacy API copy; use `packages/api/` |
| `packages/frontend/` | GraphQL lint hooks only; dev server runs from `frontend/` |
| `packages/indexer/` | Migrations only; runtime is `indexer/` |
| `packages/shared/` | Unused duplicate; use `shared/` |

---

## System Architecture

```mermaid
flowchart LR
    Horizon["Stellar Horizon API"]
    Indexer["Indexer\nindexer/ :3001"]
    PG["PostgreSQL\n:5432"]
    Redis["Redis\n:6379"]
    API["GraphQL API\npackages/api/ :4000"]
    Frontend["Frontend\nfrontend/ :5173"]

    Horizon --> Indexer
    Indexer --> PG
    API --> PG
    API --> Redis
    Frontend --> API
    Frontend -.->|WebSocket| Indexer
```

### Data Flow

1. **Indexer** polls Stellar Horizon, transforms ledger data, and writes to PostgreSQL.
2. **API** serves GraphQL queries from PostgreSQL with Redis caching and rate limiting.
3. **Frontend** renders the React dashboard, fetching data via Apollo Client.

### Technology Choices

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Monorepo | pnpm workspaces + TypeScript | Shared types, unified tooling |
| Persistence | PostgreSQL 16 | Relational ledger/transaction data |
| Cache | Redis 7 | Query caching, rate limiting, pub/sub |
| API | Apollo Server (GraphQL) | Flexible dashboard queries |
| Frontend | React + Vite | Fast HMR, modern SPA |
| Indexer | Node.js + Stellar SDK | Horizon streaming and batch processing |

---

## Deployment Architecture

```mermaid
flowchart TB
    subgraph compose ["Docker Compose"]
        PG2["postgres :5432"]
        RD["redis :6379"]
        BK["postgres-backup"]
        IDX["indexer"]
        API2["api"]
        FE["frontend"]
    end

    PG2 --> BK
    PG2 --> IDX
    PG2 --> API2
    RD --> API2
    IDX --> PG2
    FE --> API2
```

| Service | Port | Volumes |
|---------|------|---------|
| PostgreSQL | 5432 | `postgres-data`, WAL archive |
| Redis | 6379 | — |
| Indexer health | 3001 | — |
| GraphQL API | 4000 | — |
| Frontend (dev) | 5173 | — |

Backup architecture: daily dumps via `postgres-backup` service, WAL archiving enabled, retention configurable via `BACKUP_RETENTION_DAYS`. See `docs/backup-disaster-recovery.md`.

---

## Related Documentation

| Document | Content |
|----------|---------|
| `docs/environment-variables.md` | All environment variables |
| `docs/database-migrations.md` | Migration workflow |
| `docs/incident-response-runbook.md` | Incident response procedures |
| `docs/backup-disaster-recovery.md` | Backup and PITR |
| `DEVELOPMENT.md` | Local setup guide |
