# Database Migrations

Schema changes are managed with [node-pg-migrate](https://github.com/salsita/node-pg-migrate) in `packages/indexer`.

## Overview

- Migration files: `packages/indexer/migrations/`
- Version history table: `pgmigrations`
- Schema version table: `schema_version` (tracks logical schema version)
- Config: `packages/indexer/.node-pg-migraterc`
- Initial migration: `1738000000000_initial-schema.js`
- Schema version manager: `packages/indexer/src/database/schema-version.ts`

## Prerequisites

Set `DATABASE_URL` before running migrations:

```bash
export DATABASE_URL=postgresql://stellar:stellar@localhost:5432/stellar_analytics
```

## Commands

From repository root:

```bash
pnpm db:migrate
pnpm db:migrate:down
```

From `packages/indexer`:

```bash
pnpm db:migrate              # apply pending migrations
pnpm db:migrate:down         # rollback last migration
pnpm db:migrate:create add_feature_x   # scaffold new migration
pnpm db:migrate:redo         # rollback + re-apply last migration
```

The indexer also runs pending migrations automatically on startup.

## Creating a New Migration

1. Create migration file:

```bash
pnpm --filter @stellar-analytics/indexer db:migrate:create add_new_table
```

2. Implement `exports.up` and `exports.down` in the generated file.
3. Test locally:

```bash
pnpm db:migrate
pnpm db:migrate:down
pnpm db:migrate
```

4. Commit the migration file with application code that depends on it.

## Rollback

Rollback one migration:

```bash
pnpm db:migrate:down
```

Rollback multiple migrations:

```bash
pnpm --filter @stellar-analytics/indexer exec ts-node src/database/migrate.ts --down --count=2
```

Always implement `exports.down` for reversible changes.

## Existing Databases (Pre-Migration)

If your database was created from legacy `schema.sql` and already contains tables:

1. Verify schema matches the initial migration intent.
2. Mark the initial migration as applied without executing SQL:

```bash
cd packages/indexer
node-pg-migrate up 1738000000000_initial-schema --fake -f .node-pg-migraterc
```

3. Run future migrations normally with `pnpm db:migrate`.

For fresh environments, run `pnpm db:migrate` only.

## Schema Versioning

### What it does

The `schema_version` table tracks the **logical schema version** (semver) independently
of individual migration files. This enables **explicit compatibility checks** between
the application code and the database schema before any queries are executed.

### Version compatibility rules

| Condition | Result | What to do |
|---|---|---|
| DB major < code major | 🛑 FATAL | Database schema too old — run `pnpm db:migrate` |
| DB major > code major | 🛑 FATAL | Application code too old — deploy newer version |
| DB minor < code min minor | ⚠️ WARNING | Schema slightly behind — run `pnpm db:migrate` |
| Fully compatible | ✅ OK | Nothing |

PATCH differences are always non-breaking and produce no warnings.

### How it works

1. **Startup check**: The indexer calls `SchemaVersionManager.checkCompatibility()`
   after running migrations. If a fatal incompatibility is detected, the indexer
   refuses to start.
2. **Migration validation**: `SchemaVersionManager.validateMigrations()` checks
   that all expected migrations are applied, names follow conventions, timestamps
   are in order, and no unexpected migrations exist.
3. **Version recording**: After each successful `up` run, the migration runner
   records the current schema version defined in `CODE_SCHEMA_VERSION`.

### Schema version manager API

Located in `packages/indexer/src/database/schema-version.ts`:

```typescript
const versionManager = new SchemaVersionManager(pool);

// Read current schema version
const version = await versionManager.getCurrentVersion();

// Check compatibility
const result = await versionManager.checkCompatibility();
// { compatible: boolean, fatal: boolean, message: string }

// Validate all migrations are applied
const errors = await versionManager.validateMigrations([
  '1738000000000_initial-schema',
  '1738100000000_add-performance-indexes',
]);

// Record a new schema version
await versionManager.setVersion('1.1.0', 'Added new_table');

// Version history
const history = await versionManager.getVersionHistory();
```

### Bumping the schema version

When creating a new migration that changes the schema:

1. Determine the version bump:
   - **MAJOR** (`2.0.0`): Breaking schema change (table/column removal, rename)
   - **MINOR** (`1.1.0`): Additive change (new table, new column, new index)
   - **PATCH** (`1.0.1`): Non-schema change (comment update, index recreation)

2. Update `CODE_SCHEMA_VERSION` in `packages/indexer/src/database/schema-version.ts`.

3. Update `CODE_SCHEMA_DESCRIPTION` to describe the change.

4. The migration runner automatically records the new version after applying
   all pending migrations.

### Testing schema versioning

```bash
# Run schema version manager unit tests
pnpm --filter @stellar-analytics/indexer test -- --testPathPattern schema-version

# Run full migration tests (includes schema version checks)
pnpm --filter @stellar-analytics/indexer test:migrations
```

## CI/CD

GitHub Actions workflow `.github/workflows/database-migrations.yml` validates:

- `db:migrate` on empty Postgres
- migration history presence
- rollback (`db:migrate:down`)
- re-apply (`db:migrate`)
- schema_version table presence and version correctness

## Schema Migration Operational Checklist

Follow this checklist for every database schema change from local development through production deployment.

### Phase 1: Pre-Migration Planning & Validation (Local & Staging)

- [ ] **1.1 Backward Compatibility Review (Expand & Contract)**
  - Ensure all schema changes follow the *expand-and-contract* paradigm.
  - New columns must either allow `NULL` or specify a valid `DEFAULT` value so that existing application containers continue writing without error.
  - Do not drop columns, rename active tables/columns, or introduce non-null constraints without defaults in a single step.
  - Ensure foreign key constraints do not cascade delete or block hot ingestion rows.

- [ ] **1.2 Concurrency & Lock Contention Assessment**
  - Verify index additions on large tables (`transactions`, `operations`, `ledgers`) do not take exclusive table locks that block active ingestion.
  - In PostgreSQL, verify if `CONCURRENTLY` is required for index creations.
  - Review table alters for table rewrites or heavy access locks. Configure session-level safety guards where appropriate:
    ```sql
    SET lock_timeout = '3s';
    SET statement_timeout = '60s';
    ```

- [ ] **1.3 Version Bumping & Documentation**
  - Determine semantic version impact:
    - **MAJOR** (`2.0.0`): Breaking change (table/column dropped or renamed).
    - **MINOR** (`1.1.0`): Backward-compatible additive change (new table, nullable column, index).
    - **PATCH** (`1.0.1`): Non-schema fix (comments, minor index re-alignment).
  - Update `CODE_SCHEMA_VERSION` and `CODE_SCHEMA_DESCRIPTION` in `packages/indexer/src/database/schema-version.ts`.
  - Update `packages/indexer/src/database/schema.sql` to keep the reference baseline current.

- [ ] **1.4 Bidirectional Reversibility Verification**
  - Verify both forward (`up`) and backward (`down`) migrations execute cleanly in local isolation:
    ```bash
    pnpm db:migrate
    pnpm db:migrate:down
    pnpm db:migrate
    ```
  - Confirm `exports.down` completely removes added columns, tables, types, or indexes without leaving orphaned artifacts.

- [ ] **1.5 Query Plan Analysis**
  - Audit database access patterns with the explain script:
    ```bash
    sh scripts/database/analyze-query-plans.sh
    ```
  - Verify new queries utilize expected index scans rather than sequential scans.

---

### Phase 2: Execution & Deployment (Production / Staging)

- [ ] **2.1 Pre-Flight Backup & Snapshot Verification**
  - Confirm that a recent automated daily backup exists, or trigger an on-demand snapshot:
    ```bash
    pnpm backup:run
    pnpm backup:verify
    ```
  - Confirm WAL archiving is functioning normally (see `docs/backup-disaster-recovery.md`).

- [ ] **2.2 Maintenance Window & Operator Notification**
  - Post migration advisory to `#ops-alerts` detailing:
    - Target environment (Staging / Production).
    - Migration filename and description.
    - Expected duration and lock requirements.
    - Designated operator handling rollback if needed.

- [ ] **2.3 Execution Sequencing**
  - **Additive Migrations (Expand)**: Run `pnpm db:migrate` **before** rolling out new application container images.
  - **Breaking Multi-Phase Migrations**: Deploy dual-write compatible application -> run data backfill -> deploy code switching to new schema -> run contract migration.

- [ ] **2.4 Migration Execution**
  - Run the migration runner against target database:
    ```bash
    export DATABASE_URL="postgresql://user:pass@db.prod:5432/stellar_analytics"
    pnpm db:migrate
    ```
  - Verify entry in the `pgmigrations` audit table:
    ```sql
    SELECT id, name, run_on FROM pgmigrations ORDER BY id DESC LIMIT 5;
    ```

- [ ] **2.5 Schema Version Gate Confirmation**
  - Query `schema_version` to verify current recorded version:
    ```sql
    SELECT version, description, applied_at FROM schema_version ORDER BY applied_at DESC LIMIT 1;
    ```
  - Restart or boot indexer and confirm `SchemaVersionManager.checkCompatibility()` completes with `compatible: true` and no fatal exit.

---

### Phase 3: Post-Migration Monitoring & Rollback Protocol

- [ ] **3.1 Real-Time Telemetry Audit**
  - Inspect `GET /metrics` for database query error spikes and latency degradation.
  - Check `GET /metrics/queries` for slow queries (>100ms) against new tables or modified indexes.
  - Verify indexer ingestion metrics:
    - `indexer_errors_total` must remain flat.
    - `indexer_dlq_depth` must remain at 0.
    - `indexer_last_processed_ledger_sequence` must advance normally.

- [ ] **3.2 Rollback Protocol**
  - **Scenario A: Reversible non-destructive regression**:
    Rollback the migration immediately:
    ```bash
    pnpm db:migrate:down
    ```
  - **Scenario B: Data corruption or irreversible schema change**:
    1. Stop indexer ingestion:
       ```bash
       docker compose stop indexer
       ```
    2. Restore database from pre-migration backup (see `docs/backup-disaster-recovery.md`):
       ```bash
       docker compose run --rm postgres-backup /bin/sh /scripts/restore-backup.sh <pre_migration_backup.sql.gz>
       ```
    3. Verify data consistency and resume services.

---

## Operational Notes

- Do not edit applied migration files in production; create a new migration instead.
- Prefer additive migrations (new columns/tables) over destructive changes.
- Always execute Phase 1 validation (including `pnpm db:migrate:down`) locally before opening a pull request.
- Take a verified backup before production migrations (see `docs/backup-disaster-recovery.md` and Step 2.1).
- Keep `schema.sql` as a human-readable reference only; migrations in `packages/indexer/migrations/` are the authoritative source of truth.
- Bump `CODE_SCHEMA_VERSION` and `CODE_SCHEMA_DESCRIPTION` when creating a new migration.
- If a fatal schema version incompatibility is detected, the indexer will refuse to start with a clear error message explaining what needs to be done.

