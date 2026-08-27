# Environment Variables Reference

Central reference for every environment variable consumed by the Stellar Analytics Dashboard monorepo.

**Template files:** `indexer/.env.example`, `packages/api/.env.example`, `packages/e2e/.env.example`

---

## Indexer (`indexer/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STELLAR_NETWORK` | No | `testnet` | Stellar network to index (`testnet` \| `mainnet`) |
| `STELLAR_MOCK` | No | `false` | Use built-in mock Horizon instead of live network |
| `DATABASE_URL` | No* | — | PostgreSQL connection string; omit for dry-run mode |
| `POLL_INTERVAL_MS` | No | `5000` | Horizon polling interval in milliseconds |
| `BACKFILL_CONCURRENCY` | No | `4` | Parallel workers during backfill |
| `BACKFILL_BATCH_SIZE` | No | `10` | Ledgers per backfill batch |
| `BACKFILL_BATCH_DELAY_MS` | No | `200` | Delay between backfill batches |
| `HEALTH_PORT` | No | `3001` | HTTP health-check port |
| `WS_PORT` | No | `8080` | WebSocket broadcast port |
| `LOG_LEVEL` | No | `info` | Minimum log level (`trace`–`fatal`) |
| `LOG_PRETTY` | No | `false` | Human-readable coloured log output |
| `LOG_DIR` | No | `logs` | Directory for rotating log files |
| `BATCH_PERF_WARN_MS` | No | `2000` | Warn when batch processing exceeds this duration |
| `JWT_SECRET` | No | dev default | Secret for WebSocket JWT auth |
| `WS_REQUIRE_AUTH` | No | `false` | Require JWT on WebSocket connections |
| `ALERTING_ENABLED` | No | `false` | Master switch for indexer alerting |
| `SLACK_ALERTS_ENABLED` | No | `false` | Enable Slack alert channel |
| `SLACK_WEBHOOK_URL` | No | — | Slack incoming webhook URL |
| `SLACK_ALERT_COOLDOWN_MS` | No | `300000` | Cooldown between Slack alerts |
| `EMAIL_ALERTS_ENABLED` | No | `false` | Enable email alert channel |
| `EMAIL_SMTP_HOST` | No | — | SMTP server hostname |
| `EMAIL_SMTP_PORT` | No | `587` | SMTP port |
| `EMAIL_SMTP_USER` | No | — | SMTP username |
| `EMAIL_SMTP_PASSWORD` | No | — | SMTP password |
| `EMAIL_FROM_ADDRESS` | No | `indexer@stellar-analytics.local` | Sender address for alerts |
| `EMAIL_TO_ADDRESSES` | No | — | Comma-separated alert recipients |
| `EMAIL_ALERT_COOLDOWN_MS` | No | `300000` | Cooldown between email alerts |
| `ALERT_ERROR_RATE_PERCENT` | No | `10` | Error-rate threshold for alerts |
| `ALERT_DLQ_SIZE_THRESHOLD` | No | `100` | Dead-letter queue size threshold |
| `ALERT_CIRCUIT_BREAKER_OPEN` | No | `true` | Alert when Horizon circuit breaker opens |

\* Required for data persistence; without it the indexer runs in dry-run mode.

See also: `indexer/ALERTING.md`, `indexer/BACKFILL.md`

---

## API (`packages/api/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `PORT` | No | `4000` | HTTP server port |
| `NODE_ENV` | No | `development` | Runtime environment |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin(s) |
| `JWT_SECRET` | Yes (prod) | dev default | JWT signing secret (min 32 chars) |
| `LOG_LEVEL` | No | `info` | Minimum log level |
| `SLOW_QUERY_THRESHOLD_MS` | No | `100` | Threshold for slow-query logging |
| `SLOW_QUERY_LOG_SIZE` | No | `50` | Max slow queries kept in memory |
| `STATS_CACHE_TTL_SECONDS` | No | `60` | Stats cache TTL |
| `NETWORK_METRICS_CACHE_TTL_SECONDS` | No | `30` | Network metrics cache TTL |
| `STELLAR_HORIZON_URL` | No | testnet URL | Override Horizon endpoint |
| `RATE_LIMIT_ADMIN_WINDOW_MS` | No | `60000` | Admin rate-limit window |
| `RATE_LIMIT_ADMIN_MAX` | No | `2000` | Admin requests per window |
| `RATE_LIMIT_API_KEY_WINDOW_MS` | No | `60000` | API-key rate-limit window |
| `RATE_LIMIT_API_KEY_MAX` | No | `300` | API-key requests per window |
| `RATE_LIMIT_JWT_USER_WINDOW_MS` | No | `60000` | JWT user rate-limit window |
| `RATE_LIMIT_JWT_USER_MAX` | No | `1000` | JWT user requests per window |
| `RATE_LIMIT_ANON_WINDOW_MS` | No | `60000` | Anonymous rate-limit window |
| `RATE_LIMIT_ANON_MAX` | No | `100` | Anonymous requests per window |
| `PERF_ALERTING_ENABLED` | No | `false` | Enable API performance alerting |
| `PERF_SLOW_GRAPHQL_WARN_MS` | No | `1000` | GraphQL slow-query warn threshold |
| `PERF_SLOW_GRAPHQL_CRITICAL_MS` | No | `5000` | GraphQL slow-query critical threshold |
| `PERF_SLOW_HTTP_WARN_MS` | No | `2000` | HTTP slow-request warn threshold |
| `PERF_SLOW_HTTP_CRITICAL_MS` | No | `10000` | HTTP slow-request critical threshold |
| `PERF_SLOW_DB_WARN_MS` | No | `500` | DB latency warn threshold |
| `PERF_SLOW_DB_CRITICAL_MS` | No | `2000` | DB latency critical threshold |
| `PERF_ALERT_COOLDOWN_MS` | No | `300000` | Performance alert cooldown |
| `PERF_HEALTH_POLL_INTERVAL_MS` | No | `60000` | Health poll interval for perf alerts |
| `BACKUP_RETENTION_DAYS` | No | `90` | Days to retain backups |
| `BACKUP_MAX_AGE_HOURS` | No | `26` | Alert if latest backup is older than this |
| `BACKUP_ALERT_WEBHOOK` | No | — | Webhook for backup failure alerts |

See also: `docs/performance-alerting.md`, `docs/backup-disaster-recovery.md`

---

## Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_GRAPHQL_URL` | No | `http://localhost:4000/graphql` | GraphQL API endpoint |
| `VITE_STELLAR_NETWORK` | No | `testnet` | Network label shown in the UI |

No `.env` file is required for local development unless you override the API port.

---

## E2E Tests (`packages/e2e/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BASE_URL` | No | `http://localhost:5173` | Frontend URL for Playwright |
| `QUARANTINE_MODE` | No | — | Set to `run-quarantined` to include quarantined tests |
| `CI` | No | — | Set by CI runners; affects retry behaviour |

See also: `docs/flaky-test-management.md`

---

## Backup Service (Docker Compose)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BACKUP_RETENTION_DAYS` | No | `90` (prod) / `30` (dev) | Days to keep backup archives |
| `BACKUP_MAX_AGE_HOURS` | No | `26` | Stale-backup alert threshold |
| `BACKUP_ALERT_WEBHOOK` | No | — | Webhook for backup alerts |
| `VERIFY_RESTORE` | No | `true` | Validate each backup with `pg_restore -l` |
| `BACKUP_INTERVAL_SECONDS` | No | `86400` | Backup frequency (daily) |

---

## Environment Differences

| Concern | Local dev | Staging / Production |
|---------|-----------|---------------------|
| Compose file | `docker-compose.dev.yml` | `docker-compose.yml` |
| `STELLAR_MOCK` | Often `true` for offline work | Always `false` |
| `JWT_SECRET` | Dev placeholder acceptable | Must be unique, ≥ 32 chars |
| `CORS_ORIGIN` | `*` or localhost | Restricted to frontend domain |
| Backup retention | 30 days | 90 days |

---

## Startup Failure Behaviour

| Missing variable | Service | Behaviour |
|------------------|---------|-----------|
| `DATABASE_URL` | Indexer | Runs in dry-run mode (no DB writes) |
| `DATABASE_URL` | API | Fails to connect; health check returns error |
| `REDIS_URL` | API | Cache and rate limiting unavailable |
| `JWT_SECRET` (production) | API | Auth endpoints reject tokens |
