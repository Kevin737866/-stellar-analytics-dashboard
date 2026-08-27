# Stellar Analytics Dashboard — Incident Response Runbook

**Version:** 1.0  
**Last Updated:** 2026-07-27  
**Owner:** Platform Engineering Team  
**Status:** ✅ Active

---

## Table of Contents

1. [Service Architecture Overview](#1-service-architecture-overview)
2. [Monitoring & Observability](#2-monitoring--observability)
3. [Alerting Channels](#3-alerting-channels)
4. [Incident Severity Levels](#4-incident-severity-levels)
5. [Common Failure Modes & Remediation](#5-common-failure-modes--remediation)
   - [5.1 Horizon API Circuit Breaker Open](#51-horizon-api-circuit-breaker-open)
   - [5.2 Database Connection Failure](#52-database-connection-failure)
   - [5.3 Redis Cache Outage](#53-redis-cache-outage)
   - [5.4 Indexer Ledger Processing Stuck](#54-indexer-ledger-processing-stuck)
   - [5.5 High Error Rate in Indexer](#55-high-error-rate-in-indexer)
   - [5.6 Dead Letter Queue Overflow](#56-dead-letter-queue-overflow)
   - [5.7 GraphQL Rate Limit Exhaustion](#57-graphql-rate-limit-exhaustion)
   - [5.8 Slow GraphQL Queries / High Latency](#58-slow-graphql-queries--high-latency)
   - [5.9 WebSocket / Subscription Failures](#59-websocket--subscription-failures)
   - [5.10 Frontend Error Boundary Triggers](#510-frontend-error-boundary-triggers)
   - [5.11 Backup Stale / Missing](#511-backup-stale--missing)
   - [5.12 Database Migration Failure](#512-database-migration-failure)
   - [5.13 Out-of-Disk / Memory Pressure](#513-out-of-disk--memory-pressure)
   - [5.14 Authentication / Authorization Failures](#514-authentication--authorization-failures)
   - [5.15 CORS / Security Header Issues](#515-cors--security-header-issues)
6. [Health Check Endpoints](#6-health-check-endpoints)
7. [Recovery Procedures](#7-recovery-procedures)
   - [7.1 Full Service Restart](#71-full-service-restart)
   - [7.2 Database Point-in-Time Recovery (PITR)](#72-database-point-in-time-recovery-pitr)
   - [7.3 Manual Circuit Breaker Reset](#73-manual-circuit-breaker-reset)
   - [7.4 Manual Backfill for Indexer](#74-manual-backfill-for-indexer)
   - [7.5 Database Rollback](#75-database-rollback)
8. [Escalation Paths](#8-escalation-paths)
9. [Post-Incident Process](#9-post-incident-process)

---

## 1. Service Architecture Overview

The Stellar Analytics Dashboard platform consists of three main services plus supporting infrastructure:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                          │
│                    frontend/ — Port 5173 (dev)                   │
│            Serves SPA, WebSocket client for live data            │
└──────────────┬────────────────────────────────┬──────────────────┘
               │ HTTP/WS                         │ WebSocket
               ▼                                 ▼
┌──────────────────────────────┐  ┌──────────────────────────────┐
│      GraphQL API Server      │  │   Indexer Service            │
│    packages/api — Port 4000  │  │   indexer/ — Port 3001       │
│                              │  │                              │
│  ┌────────────────────────┐  │  │  ┌────────────────────────┐  │
│  │ Apollo Server (GraphQL)│  │  │  │  Horizon Streaming     │  │
│  │ Health: /health        │  │  │  │  Circuit Breaker      │  │
│  │ Metrics: GET /metrics  │  │  │  │  Dead Letter Queue    │  │
│  │ Rate Limiting (4 tiers)│  │  │  │  Idempotency Tracker  │  │
│  │ Redis Cache Layer      │  │  │  │  Rate Limiter         │  │
│  └───────────┬────────────┘  │  │  │  Zod Validation       │  │
└──────────────┬───────────────┘  │  └────────────────────────┘  │
               │                  └──────────────┬───────────────┘
               ▼                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Port 5432)                        │
│  Tables: ledgers, transactions, operations, assets, accounts,   │
│          network_metrics, asset_metrics, account_metrics,       │
│          idempotency, pgmigrations                              │
│  WAL Archiving Enabled — Backups in /backups                    │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                    Redis (Port 6379)                             │
│  Used for: Query caching, rate limiting, pub/sub for           │
│  real-time subscriptions on GraphQL subscriptions              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 Key Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | API, Indexer | PostgreSQL connection string |
| `REDIS_URL` | API, Indexer | Redis connection string |
| `STELLAR_NETWORK` | Indexer | `public` or `testnet` |
| `STELLAR_HORIZON_URL` | Indexer | Horizon API base URL |
| `LOG_LEVEL` | All | Logging verbosity (default: `info`) |
| `CORS_ORIGIN` | API | Allowed CORS origin |
| `NODE_ENV` | API | Enables/disables playground, CSP, etc. |
| `PORT` | API, Indexer | HTTP listen port |

---

## 2. Monitoring & Observability

### 2.1 Health Endpoints

| Service | Endpoint | Port | Purpose |
|---------|----------|------|---------|
| API Server | `GET /health/live` | 4000 | Liveness probe (always returns 200 if process is up) |
| API Server | `GET /health/ready` | 4000 | Readiness probe (checks Postgres + Redis) |
| API Server | `GET /health` | 4000 | Full health check with metrics |
| Indexer | `GET /health` | 3001 | Indexer health + circuit breaker state + status |
| Postgres | `pg_isready` | 5432 | Container health check (Docker) |
| Redis | `redis-cli ping` | 6379 | Container health check (Docker) |

### 2.2 Metrics Endpoints

| Service | Endpoint | Format | What it exposes |
|---------|----------|--------|-----------------|
| API Server | `GET /metrics` | Prometheus text | `graphql_server_status`, DB query counters |
| API Server | `GET /metrics/queries` | JSON | Recent slow queries + aggregate stats |
| Indexer | `GET /metrics` | Prometheus text | All indexer metrics (counters, histograms, gauges) |

### 2.3 Indexer Prometheus Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `indexer_ledgers_processed_total` | Counter | — | Total ledgers successfully processed |
| `indexer_transactions_processed_total` | Counter | — | Total transactions processed |
| `indexer_operations_processed_total` | Counter | — | Total operations processed |
| `indexer_errors_total` | Counter | `type` | Errors by type (`stream`, `backfill`, `validation`, etc.) |
| `indexer_validation_failures_total` | Counter | `entity` | Zod validation failures |
| `indexer_idempotency_skips_total` | Counter | — | Ledgers skipped (already processed) |
| `indexer_retries_total` | Counter | `operation` | Retry attempts by operation type |
| `indexer_dlq_enqueued_total` | Counter | — | Items enqueued to dead letter queue |
| `indexer_cycle_duration_seconds` | Histogram | — | Full poll cycle duration |
| `indexer_db_write_duration_seconds` | Histogram | `table` | DB write latency per table |
| `indexer_horizon_requests_total` | Counter | `endpoint` | Total Horizon API requests made |
| `indexer_horizon_request_errors_total` | Counter | `endpoint` | Horizon API request errors |
| `indexer_horizon_request_duration_seconds` | Histogram | `endpoint` | Horizon API request latency |
| `indexer_db_write_errors_total` | Counter | `table` | Database write errors per table |
| `indexer_websocket_reconnections_total` | Counter | — | WebSocket reconnection attempts |
| `indexer_circuit_breaker_state` | Gauge | — | 0=CLOSED, 1=HALF_OPEN, 2=OPEN |
| `indexer_last_processed_ledger_sequence` | Gauge | — | Last successfully processed ledger |
| `indexer_dlq_depth` | Gauge | — | Current dead letter queue size |
| `indexer_backfill_progress` | Gauge | — | Backfill completion % (0–100) |

### 2.4 API DB Query Metrics

| Metric | Endpoint | Description |
|--------|----------|-------------|
| `db_queries_total` | `GET /metrics` | Total queries executed |
| `db_slow_queries_total` | `GET /metrics` | Queries exceeding threshold (default: 100ms) |
| `db_query_duration_ms_total` | `GET /metrics` | Cumulative query time |
| `db_query_duration_ms_avg` | `GET /metrics` | Average query duration |

### 2.5 Logging

All services produce structured JSON logs. Key log files:

| Service | Log File | Contents |
|---------|----------|----------|
| API Server | `logs/error.log` | Error-level messages |
| API Server | `logs/combined.log` | All log levels |
| Indexer | `logs/indexer.log` | Indexer logs (rotated daily, 7-day retention) |

**Correlation:** Each log line includes a `module` field for filtering. Use `grep '"module":"indexer"' logs/indexer.log` to filter.

---

## 3. Alerting Channels

The indexer's alerting system (`package indexer`, Issue #143) supports two channels:

| Channel | Config Variable | Use Case |
|---------|----------------|----------|
| Slack | `SLACK_WEBHOOK_URL` | Fast notification to operations channel |
| Email | `EMAIL_SMTP_*` | Persistent record with detailed report |

### 3.1 Alert Types

| Alert | Severity | Threshold | Cooldown |
|-------|----------|-----------|----------|
| Circuit breaker opened | CRITICAL | 5 consecutive failures | 5 min |
| Database connection error | CRITICAL | Health check failure | 5 min |
| High error rate | WARNING | >10% of cycles fail | 5 min |
| DLQ size threshold | WARNING | >100 items | 5 min |
| Ledger processing failure | WARNING | Per-ledger error | 5 min |
| Backfill partial failure | WARNING | Any failed ledgers | 5 min |
| Graceful shutdown | INFO | Indexer stops | N/A |

### 3.2 Alert Cooldowns

Each alert type respects a per-channel cooldown (default: 300,000 ms / 5 minutes). Configure via:
- `SLACK_ALERT_COOLDOWN_MS`
- `EMAIL_ALERT_COOLDOWN_MS`

---

## 4. Incident Severity Levels

| Level | Label | Description | Response Time |
|-------|-------|-------------|---------------|
| **SEV-1** | 🔴 Critical | Complete service outage, data loss risk, or security breach | Immediate / < 15 min |
| **SEV-2** | 🟠 High | Major feature degradation (e.g., no real-time data, API returns errors) | < 30 min |
| **SEV-3** | 🟡 Medium | Partial degradation (slow queries, intermittent errors) | < 2 hours |
| **SEV-4** | 🔵 Low | Cosmetic issues, stale cache, non-critical alerts | Next business day |

---

## 5. Common Failure Modes & Remediation

### 5.1 Horizon API Circuit Breaker Open

**Severity:** SEV-1 / SEV-2  
**Symptoms:**
- Alert: "Circuit Breaker Opened: Horizon API"
- Indexer `/health` shows `circuitBreaker.state: "OPEN"`
- Indexer stops processing new ledgers
- Prometheus gauge `indexer_circuit_breaker_state = 2`

**Root Causes:**
- Stellar Horizon API is down or unreachable
- Network connectivity issue (firewall, DNS, proxy)
- Rate limiting from Horizon side (too many requests)

**Remediation:**

```
Step 1: Diagnose the root cause
  curl https://horizon.stellar.org/  (or your configured Horizon URL)
  Check if Horizon is reachable from the indexer host

Step 2: Check indexer logs
  grep "Circuit" logs/indexer.log
  Look for the specific error message

Step 3: If Horizon is healthy, reset the circuit breaker manually
  POST http://localhost:3001/circuit-breaker/reset
  Or via admin endpoint:
  curl -X POST http://localhost:3001/circuit-breaker/reset

Step 4: Verify recovery
  Check GET http://localhost:3001/health
  circuitBreaker.state should show "CLOSED"

Step 5: If Horizon is unhealthy
  Wait for Horizon to recover (circuit auto-transitions HALF_OPEN after 5 min cooldown)
  Monitor GET http://localhost:3001/health for automatic recovery
```

**Prevention:**
- Circuit breaker auto-recovers after 5-minute cooldown (2 successful probes needed)
- Exponential backoff retry (3 attempts, base delay 200ms)
- Rate limiter prevents overwhelming Horizon (`2000 req/min`)

---

### 5.2 Database Connection Failure

**Severity:** SEV-1  
**Symptoms:**
- Alert: "Database Connection Error"
- API `/health/ready` returns HTTP 503 with `postgres.status: "error"`
- API `/health` returns `status: "unhealthy"`
- GraphQL operations fail with database errors
- Winston error logs: `"Failed to connect to databases"`

**Root Causes:**
- PostgreSQL service is down or restarting
- `DATABASE_URL` misconfigured or expired credentials
- Network connectivity issue between services
- Connection pool exhausted (max 20 connections)
- PostgreSQL out of memory or disk space

**Remediation:**

```
Step 1: Check PostgreSQL container status
  docker ps | grep postgres
  docker logs stellar-analytics-postgres-dev

Step 2: Verify database connectivity from the service host
  PGPASSWORD=stellar psql -h localhost -U stellar -d stellar_analytics -c "SELECT 1"

Step 3: Check connection pool metrics
  curl http://localhost:4000/health
  Look at postgres.poolStats (total, idle, waiting)

Step 4: If PG is down, restart it
  docker compose restart postgres
  # Or for production:
  docker compose -f docker-compose.yml restart postgres

Step 5: If pool is exhausted
  Check for long-running queries:
    SELECT pid, now() - pg_stat_activity.query_start AS duration, query
    FROM pg_stat_activity
    WHERE state != 'idle' ORDER BY duration DESC;
  Terminate hanging connections:
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE state != 'idle' AND query_start < now() - interval '5 minutes';

Step 6: If disk is full
  Check: df -h
  Clean old data or increase volume size (see Section 5.13)

Step 7: Restart the API server after DB recovers
  docker compose restart api
```

**Prevention:**
- Connection pool with 20 max connections, 30s idle timeout, 2s connection timeout
- Automatic health check every 30s (`DB_HEALTH_CHECK_INTERVAL`)
- Retry with backoff (5 attempts, 100ms-3000ms delay)
- Statement timeout: 30s to prevent runaway queries

---

### 5.3 Redis Cache Outage

**Severity:** SEV-2  
**Symptoms:**
- API `/health/ready` returns `redis.status: "error"`
- Increased DB load (queries hit database instead of cache)
- Higher response latency from GraphQL API
- Reducer error logs: `"Redis client error"`

**Root Causes:**
- Redis container crashed or restarted
- `REDIS_URL` misconfigured
- Memory pressure on Redis (eviction may occur)

**Remediation:**

```
Step 1: Check Redis container
  docker ps | grep redis
  docker logs stellar-analytics-redis-dev

Step 2: Test Redis connectivity
  redis-cli -h localhost -p 6379 ping
  # Expected response: PONG

Step 3: If Redis is down, restart it
  docker compose restart redis

Step 4: Verify cache re-population
  The API uses cache-aside pattern — cache will re-populate on next query
  Check cache metrics: curl http://localhost:4000/health
  No manual action needed for cache warming

Step 5: If Redis is under memory pressure
  redis-cli INFO memory
  Check maxmemory policy: redis-cli CONFIG GET maxmemory-policy
  Consider: redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

**Note:** Redis outage is non-fatal — the API falls through to database queries (graceful degradation). However, it increases DB load and response times.

**Prevention:**
- Redis health check in API readiness probe
- Cache TTLs prevent stale data (30s–300s depending on query type)
- Cache metrics tracked (`cache:hits`, `cache:misses`, `cache:errors`)

---

### 5.4 Indexer Ledger Processing Stuck

**Severity:** SEV-2 / SEV-3  
**Symptoms:**
- `indexer_last_processed_ledger_sequence` gauge not advancing
- Real-time data in dashboard is stale
- No new ledgers appearing in database queries
- Logs show no new "Ledger processed" messages

**Root Causes:**
- WebSocket stream to Horizon disconnected (reconnection in progress)
- Circuit breaker OPEN (see Section 5.1)
- Processing error loop (validation failures, DB errors)
- Rate limiter throttling requests

**Remediation:**

```
Step 1: Check indexer status
  curl http://localhost:3001/health

Step 2: Check circuit breaker state
  Look at circuitBreaker.state — if OPEN, see Section 5.1

Step 3: Check indexer logs for errors
  grep -i "error\|fail\|warn" logs/indexer.log | tail -50

Step 4: Check WebSocket reconnection status
  grep "WebSocket" logs/indexer.log
  Check websocketReconnections metric

Step 5: Check rate limiter
  Grep for "rate limit" in indexer logs
  The rate limiter allows 2000 requests/min — verify not throttled

Step 6: Force restart the indexer
  docker compose restart indexer

Step 7: If restart doesn't help, trigger a manual backfill
  curl -X POST http://localhost:3001/backfill \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $BACKFILL_ADMIN_TOKEN" \
    -d '{"startSequence": <last_processed + 1>}'
```

**Prevention:**
- WebSocket reconnection with exponential backoff (max 30s delay, 10 attempts)
- Idempotency tracker prevents duplicate processing
- Dead letter queue captures failed ledgers for later retry

---

### 5.5 High Error Rate in Indexer

**Severity:** SEV-2  
**Symptoms:**
- Alert: "High Error Rate Detected" (>10% of cycles fail)
- `indexer_errors_total` counter increasing rapidly
- Many error log entries

**Root Causes:**
- Horizon API returning errors (rate limited, malformed responses)
- Data validation failures (Zod schema mismatches)
- Database write failures (constraint violations, connection issues)
- Malformed ledger data from Horizon

**Remediation:**

```
Step 1: Identify the error type
  curl http://localhost:3001/metrics | grep indexer_errors_total
  Example: indexer_errors_total{type="validation"} 42

Step 2: Check recent error logs
  grep -i "error" logs/indexer.log | tail -30

Step 3: Handle validation errors
  Check if Zod schemas need updating (new Stellar protocol features)
  Example: "ledger validation failed – skipping"
  Update validation schemas in packages/indexer/src/validation/schemas.ts

Step 4: Handle DB errors
  Check for constraint violations or connection issues
  See Section 5.2 for DB remediation

Step 5: Handle Horizon errors
  Check Horizon API status
  Consider adjusting rate limiter (2000 req/min default)
  Or adjust circuit breaker thresholds

Step 6: If error rate is transient, monitor for auto-recovery
  The indexer continues processing and retries failed items via DLQ
```

**Prevention:**
- Zod validation before any DB write (Issue #39)
- Circuit breaker prevents cascading failures
- Dead letter queue captures failures for retry
- Idempotency prevents duplicate writes on retry

---

### 5.6 Dead Letter Queue Overflow

**Severity:** SEV-3 (can escalate to SEV-2)  
**Symptoms:**
- Alert: "Dead Letter Queue Size Threshold Exceeded" (>100 items)
- `indexer_dlq_depth` gauge > 100
- `indexer_dlq_enqueued_total` counter increasing

**Root Causes:**
- Extended Horizon API outage (ledgers can't be fetched)
- Data corruption causing repeated processing failures
- Schema mismatch (ledger format changed upstream)

**Remediation:**

```
Step 1: Assess the size and growth rate
  curl http://localhost:3001/health | grep dlq
  Check dlqDepth

Step 2: Investigate the root cause of failures
  grep "DeadLetterQueue" logs/indexer.log | tail -20
  Identify the ledger sequences that are failing

Step 3: Attempt manual retry
  The RecoveryJob automatically retries failed ledgers
  Wait for the next retry cycle (interval configured in RecoveryJob)

Step 4: If retries keep failing
  Check if the ledger data format has changed
  Compare failed ledger with known good ledger
  Update Zod schemas if needed

Step 5: As a last resort, drain the DLQ
  This should only be done after fixing the root cause
  # In Node.js REPL:
  # const { dlq } = require('./error-recovery/DeadLetterQueue');
  # dlq.clear();

Step 6: After DLQ is drained, trigger a backfill
  curl -X POST http://localhost:3001/backfill \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $BACKFILL_ADMIN_TOKEN" \
    -d '{"startSequence": <first_failed_sequence>}'
```

**Prevention:**
- DLQ items are automatically retried with exponential backoff
- Alerting when DLQ exceeds threshold (default: 100 items)
- Monitor DLQ depth via Prometheus gauge

---

### 5.7 GraphQL Rate Limit Exhaustion

**Severity:** SEV-3  
**Symptoms:**
- Users receiving HTTP 429 "Too many requests"
- Winston warn logs: "rate limit exceeded"
- Alerting (if configured) for elevated 429 responses

**Root Causes:**
- Client sending too many requests (bug or aggressive polling)
- API key compromised or shared widely
- DDoS / abusive traffic pattern
- Thresholds set too low for normal usage patterns

**Remediation:**

```
Step 1: Identify the affected client
  Check rate limit logs:
    grep "rate limit exceeded" logs/combined.log
  Look for userId, apiKey, or IP address

Step 2: Check current rate limit configuration
  Environment variables:
    RATE_LIMIT_ADMIN_MAX=2000    (per 60s window)
    RATE_LIMIT_API_KEY_MAX=300   (per 60s window)
    RATE_LIMIT_JWT_USER_MAX=1000 (per 60s window)
    RATE_LIMIT_ANON_MAX=100      (per 60s window)

Step 3: If legitimate traffic is being rate limited
  Increase the relevant limit:
    export RATE_LIMIT_JWT_USER_MAX=2000
    docker compose restart api

Step 4: If abusive traffic is detected
  Block the offending IP at the load balancer / firewall level
  Or revoke the compromised API key

Step 5: Verify the fix
  curl -X POST http://localhost:4000/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <valid_token>" \
    -d '{"query": "{ __typename }"}'
  Should return 200, not 429
```

**Prevention:**
- 4-tier rate limiting: Admin > JWT User > API Key > Anonymous
- Per-key and per-user rate limit buckets
- Rate limit headers returned (standard format)
- Rate limit violations logged for auditing

---

### 5.8 Slow GraphQL Queries / High Latency

**Severity:** SEV-3 / SEV-4  
**Symptoms:**
- Winston warn logs: "Slow GraphQL query detected" (>1000ms)
- User reports of slow dashboard loading
- `db_slow_queries_total` counter increasing
- High `db_query_duration_ms_avg`

**Root Causes:**
- Missing database indexes
- N+1 query patterns (DataLoader not being used)
- Large pagination requests (high `first` values)
- Cache miss (Redis down or cold cache)
- Complex queries exceeding design limits

**Remediation:**

```
Step 1: Identify the slow query
  Check slow query log:
    curl http://localhost:4000/metrics/queries
  Or grep: grep "Slow GraphQL query" logs/combined.log

Step 2: Check DB query performance
  curl http://localhost:4000/metrics/queries
  Look for recent slow queries with high durationMs

Step 3: Analyze query execution plan
  Run the identified SQL query with EXPLAIN ANALYZE
  Look for:
    - Seq Scan on large tables (should use index scan)
    - High "rows removed by filter"
    - High "actual time" values

Step 4: Fix missing indexes
  Create a new migration:
    pnpm --filter @stellar-analytics/indexer db:migrate:create add_index_for_xyz
  Apply: pnpm db:migrate

Step 5: Optimize the GraphQL query
  Reduce pagination limit:
    Instead of first: 100, use first: 20
  Ensure DataLoaders are being used for batched lookups

Step 6: Clear cache if stale
  await db.cacheDelPattern('*')
```

**Prevention:**
- DataLoaders for batch querying (N+1 prevention)
- Redis caching for expensive queries (30-300s TTL)
- Query complexity analysis (max 1000) and depth limiting (max 10)
- Slow query threshold at 100ms (configurable via `SLOW_QUERY_THRESHOLD_MS`)
- Monthly index review cadence (see `docs/query-performance.md`)

---

### 5.9 WebSocket / Subscription Failures

**Severity:** SEV-2 / SEV-3  
**Symptoms:**
- Real-time dashboard data not updating
- Users see stale data in live views
- Frontend `ConnectionStatus` shows "Disconnected" or "Connection error"
- API logs: "WebSocket error" at warn level
- Frontend logs: WebSocket reconnection attempts

**Root Causes:**
- API server restart (WebSocket connections dropped)
- Network interruption between client and server
- Subscription rate limit exceeded (1000 events/min per IP)
- GraphQL subscription schema mismatch

**Remediation:**

```
Step 1: Check API server status
  curl http://localhost:4000/health
  Ensure server is healthy and accepting connections

Step 2: Check WebSocket connections on server
  grep "WebSocket" logs/combined.log | tail -10
  Look for disconnect/reconnect patterns

Step 3: Check subscription rate limits
  grep "Subscription rate limit" logs/combined.log
  Subscription rate limit: 1000 events/min per IP

Step 4: Check frontend WebSocket status
  The frontend uses graphql-ws with exponential backoff reconnection
  Max retry: Infinity (with backoff up to 30s)
  The useWebSocketStatus hook exposes connection state

Step 5: Restart the API server if needed
  docker compose restart api

Step 6: For persistent subscription failures
  Check if the subscription query is valid:
  The frontend subscription queries are in:
    packages/frontend/src/graphql/queries.ts
    packages/frontend/src/graphql/apollo-client.ts
```

**Frontend WebSocket Status Indicators:**
- **isLive**: `true` when connected
- **isError**: `true` when disconnected or error state
- **isPending**: `true` when connecting or reconnecting
- Component: `ConnectionStatus.tsx` shows live indicator

**Prevention:**
- `graphql-ws` client with automatic reconnection (exponential backoff, max 30s)
- Subscription rate limiting per IP
- WebSocket event rate limiting per IP
- Periodic rate limit cleanup (every 60s)

---

### 5.10 Frontend Error Boundary Triggers

**Severity:** SEV-3 / SEV-4  
**Symptoms:**
- Users see "Something went wrong" page with AlertTriangle icon
- Browser console logs: `ErrorBoundary caught error`
- Component tree crashes rendering

**Root Causes:**
- GraphQL query returns unexpected data shape
- Missing or null data where component expects values
- JavaScript runtime error in component logic
- Network failure during data fetch

**Remediation:**

```
Step 1: Identify the error from browser console
  Open browser DevTools → Console
  Look for "ErrorBoundary caught error" with stack trace

Step 2: Reproduce the error
  Navigate to the page where the error occurs
  Check what data is being fetched

Step 3: Click "Try again" button
  The ErrorBoundary component provides a retry button
  This re-renders children (triggers re-fetch)

Step 4: If error persists, check the GraphQL query
  Open Network tab, find the failing GraphQL operation
  Check the response data shape matches component expectations

Step 5: Check if API is returning errors
  curl http://localhost:4000/graphql -d '{"query":"..."}'
  Compare with expected schema

Step 6: Fix the component if needed
  Add null checks / optional chaining for potentially missing fields
  Update TypeScript types to match actual data shape
```

**Common Frontend Errors:**
| Error | Root Cause | Fix |
|-------|------------|-----|
| `Cannot read properties of null` | Null data from API | Add null checks with optional chaining |
| `TypeError: data.map is not a function` | Wrong data shape | Fix GraphQL query or data transformation |
| `GraphQL error: ...` | Backend error | Check API logs for details |

**Prevention:**
- `ErrorBoundary` wraps all route components
- Loading skeletons during data fetch (prevents rendering blank states)
- Apollo Client error link captures and logs errors
- TypeScript types validated against GraphQL schema

---

### 5.11 Backup Stale / Missing

**Severity:** SEV-3 (can escalate to SEV-1 if data loss occurs)  
**Symptoms:**
- Alert: Backup health check fails (non-zero exit from `pnpm backup:health`)
- No backup files in `backups/postgres/` or `backups/dev-postgres/`
- `BACKUP_ALERT_WEBHOOK` receives failure notification

**Root Causes:**
- Postgres backup container not running
- Disk space full preventing backup writes
- Permission issues on backup volume
- Backup script error

**Remediation:**

```
Step 1: Check backup container status
  docker ps | grep postgres-backup
  docker logs <backup-container-id> --tail 50

Step 2: Run an immediate backup
  pnpm backup:run

Step 3: Verify the backup
  pnpm backup:verify

Step 4: Check backup health
  pnpm backup:health

Step 5: If backup container is missing or failed
  docker compose up -d postgres-backup

Step 6: If disk is full
  Clean old backups:
    docker compose run --rm postgres-backup \
      find /backups/daily -type f -mtime +90 -delete
  Or increase BACKUP_RETENTION_DAYS

Step 7: Verify backup directory permissions
  ls -la backups/postgres/
  Ensure the container can write to the volume
```

**Prevention:**
- Daily automated backups (configurable interval)
- Backup verification (SHA-256 + `pg_restore -l`)
- Health monitoring (check backup freshness every cycle)
- Retention cleanup (90 days production, 30 days dev)
- Webhook alerts on backup failure

---

### 5.12 Database Migration Failure

**Severity:** SEV-1 / SEV-2  
**Symptoms:**
- Indexer fails to start with migration error
- `pnpm db:migrate` fails with SQL errors
- API returns errors for queries against new/changed tables
- `pgmigrations` table shows unapplied migrations

**Root Causes:**
- Migration conflicts (trying to create existing objects)
- Destructive changes (DROP TABLE, DROP COLUMN) with dependencies
- Data type mismatches or constraint violations
- Migration file error (syntax or logic)

**Remediation:**

```
Step 1: Check the migration error
  grep -i "error\|fail" logs/indexer.log | grep -i migration

Step 2: Identify which migration failed
  SELECT * FROM pgmigrations ORDER BY applied_at DESC;
  Look for the last successfully applied migration

Step 3: Rollback the failed migration
  pnpm db:migrate:down

Step 4: Fix the migration file
  Edit the migration in packages/indexer/migrations/
  Ensure exports.up and exports.down are correct

Step 5: Re-apply
  pnpm db:migrate

Step 6: If the migration cannot be rolled back
  Create a new migration that reverts/fixes the change
  Apply: pnpm db:migrate

Step 7: If the database is in a broken state
  Restore from backup (see Section 7.2)
```

**Critical Rule:** Never edit applied migration files in production. Create a new migration instead.

**Prevention:**
- Always implement `exports.down` for rollback
- Test migrations in staging before production
- Run `pnpm db:migrate:redo` to validate up+down
- Automated CI validates migrations on empty Postgres
- Take a backup before production migrations (`pnpm backup:run`)

---

### 5.13 Out-of-Disk / Memory Pressure

**Severity:** SEV-1 (disk) / SEV-2 (memory)  
**Symptoms:**
- Container health checks failing
- PostgreSQL errors: "No space left on device"
- API/Indexer crashing with OOM (Out of Memory) errors
- Slow query responses (memory pressure)
- Backup failures (cannot write to disk)

**Root Causes:**
- Database growing beyond available volume space
- Log files consuming disk space (no rotation configured)
- Memory leak in application code
- Insufficient container memory limits

**Remediation:**

```
Step 1: Check disk usage
  docker system df
  df -h on the host
  Check volumes: docker volume ls

Step 2: Check PostgreSQL data size
  curl http://localhost:4000/health
  Look at database.sizeFormatted

Step 3: Clean up old data
  # Remove old backup files
  find backups/postgres -type f -mtime +90 -delete
  
  # Remove old logs
  find logs -type f -mtime +7 -delete
  
  # Run data retention cleanup (if service exists)
  # The retention service cleans old metrics data

Step 4: Increase volumes
  Update docker-compose.yml:
    volumes:
      postgres_data:
        driver: local
        driver_opts:
          size: "20GB"  # Increase as needed

Step 5: For memory pressure
  Check container memory limits:
    docker stats
  Update docker-compose.yml memory limits:
    services:
      postgres:
        deploy:
          resources:
            limits:
              memory: 2G

Step 6: Restart affected services
  docker compose restart postgres api indexer
```

**Prevention:**
- Data retention policies (365 days network metrics, 90 days asset/account metrics)
- Log rotation (daily rotation, 7-day retention for indexer logs)
- `statement_timeout: 30s` prevents runaway queries
- Connection pool limits (max 20 connections)

---

### 5.14 Authentication / Authorization Failures

**Severity:** SEV-2 / SEV-3  
**Symptoms:**
- Users cannot log in
- GraphQL errors: "Unauthorized" or "Forbidden"
- JWT token validation errors in API logs
- API key authentication failing

**Root Causes:**
- JWT secret changed (invalidates all existing tokens)
- Token expired (configurable expiry period)
- Auth service misconfiguration
- API key revoked or invalid

**Remediation:**

```
Step 1: Check API logs
  grep -i "auth\|token\|jwt\|unauthorized" logs/combined.log | tail -20

Step 2: Verify JWT configuration
  Check JWT_SECRET environment variable is set and consistent
  Check JWT_EXPIRY environment variable

Step 3: Test authentication flow
  curl -X POST http://localhost:4000/graphql \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <test_token>" \
    -d '{"query": "{ __typename }"}'

Step 4: Check auth service
  authService is initialized in packages/api/src/services/auth.ts
  Check that auth directives are correctly applied to protected queries

Step 5: For API key issues
  Check x-api-key header validation
  authService.validateApiKey() in packages/api/src/services/auth.ts

Step 6: As a workaround
  Users can re-login to get a fresh JWT token
  API key holders can request a new key
```

**Prevention:**
- Structured auth service with JWT + API key support
- Auth directive on protected GraphQL fields
- Rate limiting on auth endpoints

---

### 5.15 CORS / Security Header Issues

**Severity:** SEV-3 / SEV-4  
**Symptoms:**
- Browser console: CORS errors when making API requests
- Frontend cannot reach GraphQL endpoint
- Security warnings in browser

**Root Causes:**
- `CORS_ORIGIN` misconfigured for production
- Missing or incorrect `credentials: true`
- Frontend URL not matching allowed origin
- Helmet CSP blocking inline scripts

**Remediation:**

```
Step 1: Check CORS configuration
  curl -I -H "Origin: https://your-frontend.com" http://localhost:4000/graphql
  Look for Access-Control-Allow-Origin header

Step 2: Verify CORS_ORIGIN env var
  echo $CORS_ORIGIN
  Should be a specific URL in production (not *)

Step 3: For multiple origins
  Update the CORS middleware to support function-based validation:
  See docs/cors.md for the configuration example

Step 4: Check Helmet CSP settings
  CSP is disabled by default for GraphQL compatibility
  If re-enabling, ensure inline scripts are allowed:
    scriptSrc: ["'self'", "'unsafe-inline'"]

Step 5: Restart API after CORS changes
  docker compose restart api
```

**Prevention:**
- Environment-based CORS configuration
- `credentials: true` for JWT auth support
- CSP disabled in development, configurable for production
- Preflight OPTIONS requests handled automatically

---

## 6. Health Check Endpoints

### 6.1 API Server (Port 4000)

**Liveness Probe:**
```bash
curl http://localhost:4000/health/live
# {"status":"alive","timestamp":"2026-07-27T00:00:00.000Z"}
```

**Readiness Probe:**
```bash
curl http://localhost:4000/health/ready
# Healthy: {"status":"ready","postgres":"connected","redis":"connected"}
# Unhealthy: HTTP 503 {"status":"not_ready","postgres":"error","redis":"error"}
```

**Full Health Check:**
```bash
curl http://localhost:4000/health
# Returns: status, postgres status+latency+pool, redis status+latency,
#          database size, replication lag, query metrics
```

### 6.2 Indexer (Port 3001)

```bash
curl http://localhost:3001/health
# Returns: status, timestamp, isRunning, lastProcessedLedger,
#          horizonUrl, circuitBreaker state+stats, idempotencyCacheSize

curl http://localhost:3001/metrics
# Prometheus-format metrics
```

---

## 7. Recovery Procedures

### 7.1 Full Service Restart

Use this when a clean restart is needed (e.g., after config changes, deployment, or cascading failure):

```bash
# Graceful restart (zero-downtime if configured)
docker compose restart

# Full rebuild + restart (after code changes)
docker compose up -d --build

# Check all services are healthy
docker compose ps
curl http://localhost:4000/health/live
curl http://localhost:4000/health/ready
curl http://localhost:3001/health
```

**Shutdown Order (automatic via graceful shutdown handlers):**
1. Stop realtime publisher
2. Stop Apollo Server (no new requests)
3. Disconnect from databases
4. Close HTTP server

**Startup Order:**
1. PostgreSQL → 2. Redis → 3. API Server → 4. Indexer (waits for migrations to complete)

### 7.2 Database Point-in-Time Recovery (PITR)

**Use when:** Data corruption, accidental data loss, or need to restore to a specific point in time.

**Prerequisites:** WAL archiving enabled (configured in `docker-compose.yml`).

```bash
Step 1: Stop services writing to the database
  docker compose stop api indexer

Step 2: Identify the target recovery time
  Determine the exact timestamp to recover to

Step 3: Restore the latest valid base backup
  docker compose run --rm postgres-backup \
    /bin/sh /scripts/restore-postgres-backup.sh \
    /backups/daily/<latest-valid-backup>.dump

Step 4: Configure PostgreSQL recovery
  Set recovery_target_time to the target timestamp
  Set restore_command to read from the WAL archive

Step 5: Start PostgreSQL and verify recovery
  docker compose start postgres
  Check logs for recovery completion

Step 6: Validate recovered data
  Run smoke queries:
    SELECT COUNT(*) FROM ledgers;
    SELECT MAX(sequence) FROM ledgers;

Step 7: Restart API and Indexer
  docker compose start api indexer
```

**RPO Target:** ≤ 24 hours (configurable via `BACKUP_INTERVAL_SECONDS`)  
**RTO Target:** Depends on database size and restore method

### 7.3 Manual Circuit Breaker Reset

**Use when:** Horizon API has recovered, but the circuit breaker is still OPEN (no automatic transition yet).

```bash
curl -X POST http://localhost:3001/circuit-breaker/reset

# Verify:
curl http://localhost:3001/health | grep circuitBreaker
# Expected: circuitBreaker.state = "CLOSED"
```

**Auto-recovery timeline:**
1. Circuit opens after 5 consecutive failures
2. After 5-minute cooldown, transitions to HALF_OPEN
3. In HALF_OPEN, 2 consecutive successes re-close the circuit
4. Any failure in HALF_OPEN re-opens the circuit

### 7.4 Manual Backfill for Indexer

**Use when:** Indexer missed some ledgers (e.g., due to outage, circuit breaker, or after recovery).

```bash
# Via HTTP endpoint (requires BACKFILL_ADMIN_TOKEN if configured)
curl -X POST http://localhost:3001/backfill \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BACKFILL_ADMIN_TOKEN" \
  -d '{"startSequence": 50000, "endSequence": 51000}'

# Via CLI (for larger ranges):
cd packages/indexer
npx tsx src/backfill-cli.ts --start=50000 --end=51000 --network=testnet --concurrency=8
```

**Backfill features:**
- **Idempotent**: Already-processed ledgers are skipped
- **Parallel processing**: Up to `BACKFILL_CONCURRENCY` (default: 4) workers
- **Progress tracking**: Logged every batch (e.g., `42% | processed=420 ETA 58s`)
- **Resume capability**: Re-run with same `--start` to resume from failures
- **Graceful cancellation**: SIGINT/SIGTERM aborts after current batch

### 7.5 Database Rollback

**Use when:** A migration introduced a breaking change and needs to be reverted.

```bash
# Rollback one migration
cd packages/indexer
pnpm db:migrate:down

# Rollback multiple migrations
pnpm --filter @stellar-analytics/indexer exec ts-node src/database/migrate.ts --down --count=2

# Re-apply the last migration (test rollback)
pnpm db:migrate:redo

# Verify migration state
SELECT * FROM pgmigrations ORDER BY applied_at DESC;
```

**Always take a backup before rolling back in production:**
```bash
pnpm backup:run
```

---

### 5.16 API Request Timeout

**Severity:** SEV-3
**Symptoms:**
- HTTP 503 responses with `"Request timeout"` message
- Winston error logs: `"Request timeout reached"`
- Users see errors in dashboard

**Root Causes:**
- Long-running GraphQL operations (>30s)
- Database query hanging or slow (>30s)
- External service (Horizon) call taking too long
- Resource contention (CPU, memory, connection pool)

**Remediation:**

```
Step 1: Check request timeout logs
  grep "Request timeout" logs/combined.log | tail -20
  Look for path, method, and timeoutMs (default 30000)

Step 2: Check GraphQL slow query logs
  grep "Slow GraphQL query" logs/combined.log | tail -10
  Look for operations taking >1000ms

Step 3: Check database slow queries
  curl http://localhost:4000/metrics/queries
  Identify queries with high durationMs

Step 4: Check if there's a stuck operation
  Look for patterns: same query being retried repeatedly
  Same source account or IP making many requests

Step 5: If a specific query is causing timeouts
  See Section 5.8 for query optimization steps
  Consider increasing timeout threshold if justified:
    export TIMEOUT_MS=60000
    docker compose restart api

Step 6: If the server is overloaded
  Check CPU/memory: docker stats
  Scale horizontally or increase resources
  Check connection pool usage: curl http://localhost:4000/health
```

**Prevention:**
- 30s request timeout at Express middleware level
- 30s statement timeout on PostgreSQL pool
- 30s HTTP server timeout
- GraphQL 30s+ queries logged at `error` level (vs `warn` at 1000ms+)
- Connection pool max 20 prevents runaway connections

---

## 8. Escalation Paths

### 8.1 Escalation Matrix

| Incident Type | L1 (First Responder) | L2 (Engineering) | L3 (Senior/Architect) |
|---------------|---------------------|------------------|----------------------|
| Horizon API circuit breaker | On-call engineer | Platform team | Stellar infra team |
| Database down/corruption | On-call engineer | DB admin / Platform | Engineering lead |
| Data loss / corruption | On-call engineer | DB admin + Platform | Engineering lead |
| Security breach | On-call engineer | Security + Platform | CTO / Engineering VP |
| API performance degradation | On-call engineer | API team | Senior backend |
| Indexer stuck/stale data | On-call engineer | Indexer team | Senior backend |
| Frontend broken | On-call engineer | Frontend team | Senior frontend |
| Infrastructure (disk, memory) | On-call engineer | DevOps / Platform | Infrastructure lead |

### 8.2 Communication Channels

| Channel | Purpose | Who has access |
|---------|---------|----------------|
| `#ops-alerts` (Slack) | Automated alerts from alerting system | All engineers + on-call |
| `#incident-response` (Slack) | Real-time incident coordination | All engineers + leads |
| Email (ops@example.com) | Persistent alert record | Platform team |
| PagerDuty (if configured) | On-call escalation | Scheduled on-call |

### 8.3 Escalation Timeframes

| Severity | L1 Response | L2 Escalation | L3 Escalation |
|----------|-------------|---------------|---------------|
| SEV-1 | Immediate | 15 min | 30 min |
| SEV-2 | 15 min | 30 min | 60 min |
| SEV-3 | 30 min | 2 hours | 4 hours |
| SEV-4 | Next business day | N/A | N/A |

---

## 9. Post-Incident Process

### 9.1 Immediate (During Incident)

- [ ] Acknowledge the incident and communicate in `#incident-response`
- [ ] Assign an Incident Commander (IC) — one person coordinates response
- [ ] Document timeline and actions in the incident channel
- [ ] Focus on mitigation/recovery first, root cause analysis second

### 9.2 After Resolution

- [ ] Verify all health endpoints return healthy
- [ ] Confirm data integrity (row counts, recent ledger, API queries)
- [ ] Monitor for 15-30 minutes to ensure stability
- [ ] Post incident summary to `#incident-response`

### 9.3 Post-Mortem (Within 48 Hours)

- [ ] Create incident report with timeline
- [ ] Identify root cause
- [ ] Document what went well and what could be improved
- [ ] Define action items with owners and deadlines
- [ ] File issues for any TODO items discovered

### 9.4 Incident Report Template

```markdown
## Incident Report: [Title]

**Date:** YYYY-MM-DD
**Severity:** SEV-X
**Duration:** HH:MM (detection → resolution)
**Impact:** [What was affected, how many users]

### Timeline
| Time (UTC) | Event | Action |
|------------|-------|--------|
| HH:MM | [Detection] | [What happened] |
| HH:MM | [Response] | [What was done] |
| HH:MM | [Resolution] | [How it was fixed] |

### Root Cause
[One-paragraph explanation of why the incident occurred]

### Resolution
[Steps taken to resolve the incident]

### Action Items
- [ ] [Action] — Owner — Due date
- [ ] [Action] — Owner — Due date

### Lessons Learned
[What went well, what could be improved]
```

---

## Appendices

### A. Quick Reference: Useful Commands

```bash
# Service status
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 indexer

# Health checks
curl http://localhost:4000/health
curl http://localhost:3001/health

# Metrics
curl http://localhost:4000/metrics
curl http://localhost:3001/metrics

# Database
docker compose exec postgres psql -U stellar -d stellar_analytics
psql -h localhost -U stellar -d stellar_analytics -c "SELECT count(*) FROM ledgers;"

# Backups
pnpm backup:run
pnpm backup:verify
pnpm backup:health

# Migrations
pnpm db:migrate
pnpm db:migrate:down

# Reset circuit breaker
curl -X POST http://localhost:3001/circuit-breaker/reset

# Manual backfill
curl -X POST http://localhost:3001/backfill \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BACKFILL_ADMIN_TOKEN" \
  -d '{"startSequence": 1}'
```

### B. Key Ports

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache / Pub/Sub |
| API Server | 4000 | GraphQL + REST endpoints |
| Indexer | 3001 | Health + Metrics + Admin |

### C. Configuration Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Production service definitions |
| `docker-compose.dev.yml` | Development service definitions |
| `packages/api/.env` | API environment configuration |
| `packages/indexer/.env` | Indexer environment configuration |
| `packages/indexer/.node-pg-migraterc` | Database migration configuration |

### D. Related Documentation

| Document | Location | Content |
|----------|----------|---------|
| Error Handling & Logging | `docs/error-handling-and-logging.md` | Winston config, log levels, GraphQL error handling |
| Backup & Disaster Recovery | `docs/backup-disaster-recovery.md` | Backup strategy, PITR, restore procedures |
| Query Performance | `docs/query-performance.md` | Index strategy, slow query monitoring, caching |
| GraphQL Query Limits | `docs/graphql-query-limits.md` | Depth limiting, complexity analysis |
| CORS Configuration | `docs/cors.md` | CORS settings by environment |
| Security Headers | `docs/security-headers.md` | Helmet configuration |
| Database Migrations | `docs/database-migrations.md` | Migration workflow, rollback |
| Indexer Alerting | `indexer/ALERTING.md` | Alert configuration, troubleshooting |
| Indexer Backfill | `indexer/BACKFILL.md` | Backfill CLI, parallel processing |
| Caching Strategy | `CACHING.md` | Redis cache TTLs, monitoring |

---

**Document Change History**

| Date | Author | Change |
|------|--------|--------|
| 2026-07-27 | Platform Team | Initial version |
