# Backup, Restore, and Disaster Recovery

**Last Updated:** 2026-08-27  
**Last Verified:** 2026-08-27  
**Next Review:** 2026-09-27  
**Owner:** Platform Engineering Team

This project now includes an automated PostgreSQL backup strategy with retention, verification, and point-in-time recovery (PITR) support.

## What Is Implemented

- Automated daily backups using the `postgres-backup` service in both `docker-compose.yml` and `docker-compose.dev.yml`
- Retention cleanup (`BACKUP_RETENTION_DAYS`) defaulting to:
  - Production compose: 90 days
  - Development compose: 30 days
- Backup verification:
  - SHA-256 checksum generation
  - Backup archive validation with `pg_restore -l`
- Point-in-time recovery prerequisites:
  - WAL archiving enabled on PostgreSQL (`archive_mode=on`)
  - WAL files persisted under `backups/wal` (or `backups/dev-wal`)
- Backup health monitoring script with optional webhook alerts

## Directory Layout

- Daily dumps: `backups/postgres` (dev: `backups/dev-postgres`)
- WAL archive files: `backups/wal` (dev: `backups/dev-wal`)
- Backup scripts: `scripts/backup`

## Backup Configuration

Set these environment variables in your runtime environment as needed:

- `BACKUP_RETENTION_DAYS` - how many days to keep backups (30-90 recommended)
- `BACKUP_MAX_AGE_HOURS` - alert threshold for stale backups (default 26)
- `BACKUP_ALERT_WEBHOOK` - optional Slack/Teams/webhook endpoint for failure alerts
- `VERIFY_RESTORE` - `true`/`false` for per-backup archive verification
- `BACKUP_INTERVAL_SECONDS` - backup frequency (default 86400 for daily)

## Operations Runbook

### 1) Run an immediate backup

```bash
pnpm backup:run
```

### 2) Verify latest backup

```bash
pnpm backup:verify
```

### 3) Check backup freshness (monitoring probe)

```bash
pnpm backup:health
```

Use this script in your scheduler/monitoring platform. A non-zero exit code means action is required.

## Restore Procedure

To restore a full dump:

```bash
docker compose run --rm postgres-backup /bin/sh /scripts/restore-postgres-backup.sh /backups/daily/<backup-file>.dump
```

This process:

1. Terminates active sessions for the target DB
2. Drops and recreates the target DB
3. Restores from the specified dump file

## Point-In-Time Recovery (PITR) Procedure

PITR uses a base backup plus WAL archives.

High-level process:

1. Stop services writing to PostgreSQL.
2. Restore the latest valid base backup.
3. Configure PostgreSQL recovery settings for target time (`recovery_target_time`) and WAL archive location.
4. Start PostgreSQL and allow replay of WAL files up to target point.
5. Validate recovered data and re-enable traffic.

Because PITR requires environment-specific recovery configuration, run this first in staging with a copy of production backup + WAL data before production use.

## Disaster Recovery Expectations

- RPO target: <= 24 hours (or lower if reducing `BACKUP_INTERVAL_SECONDS`)
- RTO target: defined by restore size and infrastructure readiness
- Minimum test cadence: monthly restore test in non-production
- Required incident artifacts:
  - backup file used
  - checksum verification output
  - recovery target time (for PITR)
  - validation query results

## Restoration Testing Schedule

Run at least once per month:

1. Execute `pnpm backup:run`
2. Restore into a staging database using `restore-postgres-backup.sh`
3. Run smoke queries (row counts, latest ledger, API health checks)
4. Capture duration, issues found, and remediation actions

Document each drill in [`docs/operations/incident-drills.md`](./operations/incident-drills.md).

## Restoration Testing Log

| Date | Procedure | Environment | Duration | Result | Notes |
|------|-----------|-------------|----------|--------|-------|
| 2026-08-27 | Backup verify (`pnpm backup:verify`) | Local dev | ~2 min | Pass | Checksum and archive validation succeeded |
