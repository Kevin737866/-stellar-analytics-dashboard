# Performance Alerting

Alerts contributors and operators when API or dashboard response times degrade unexpectedly.

## Overview

Two complementary layers handle performance alerting:

| Layer | Location | What it tracks |
|-------|----------|----------------|
| **API server** | `packages/api/src/services/performance-alerting.ts` | GraphQL operation duration, HTTP request duration, Postgres/Redis health latency |
| **Frontend** | `packages/frontend/src/hooks/usePerformanceMonitor.ts` | Apollo Client round-trip time, browser page-load time |

---

## Account Activity Alerts

Monitor for unusual account behavior by configuring thresholds against ledger and transaction metrics.

### Thresholds

| Metric | Warning | Critical | Window |
|--------|---------|----------|--------|
| Transaction volume spike | > 3× 24h average | > 5× 24h average | 1 hour |
| Sudden balance change | > 20% movement | > 50% movement | 15 minutes |
| New signer addition | Any change on high-value accounts | Any change on accounts with > 1M XLM | Real-time |
| Failed tx rate | > 5% of account txns | > 15% of account txns | 30 minutes |

### Detection logic

1. Aggregate `transactions` by `sourceAccount` over the configured window.
2. Compare current volume/burn against the 7d rolling average for that account.
3. If an account crosses a threshold, emit an alert with:
   - `accountId`
   - `metric` (`transaction_volume` / `balance_change` / `new_signer` / `failure_rate`)
   - `currentValue`
   - `threshold`
   - `windowStart` / `windowEnd`
4. Respect a per-account cooldown so one noisy account does not spam channels.

### Frontend surfacing

- `AccountDetail` shows a `⚠` indicator next to accounts with active alerts.
- Clicking the indicator opens the account activity log filtered to the alert window.

### Configuration

```dotenv
# Feature flag (off by default)
ACCOUNT_ACTIVITY_ALERTS_ENABLED=true

# Thresholds
ALERT_TXN_VOLUME_WARN_FACTOR=3
ALERT_TXN_VOLUME_CRITICAL_FACTOR=5
ALERT_BALANCE_CHANGE_WARN_PCT=20
ALERT_BALANCE_CHANGE_CRITICAL_PCT=50
ALERT_FAILED_RATE_WARN_PCT=5
ALERT_FAILED_RATE_CRITICAL_PCT=15

# Windows (seconds)
ALERT_VOLUME_WINDOW_SEC=3600
ALERT_BALANCE_WINDOW_SEC=900
ALERT_FAILURE_RATE_WINDOW_SEC=1800

# Notification channels
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
ALERT_EMAIL_TO_ADDRESSES=ops@example.com,team@example.com
```

### Debugging

- API logs each alert at `warn` level with structured metadata.
- Re-run detection manually:
  ```bash
  pnpm --filter @stellar-analytics/api exec ts-node scripts/detect-account-activity-alerts.ts
  ```

---

## API-Side Alerting

### How it works

`PerformanceAlertingService` is initialized in `ApiServer.start()` and integrated via:

1. **Apollo Server plugin** – `willSendResponse` fires `onGraphQLOperation(name, durationMs)` after every operation.
2. **Express middleware** – an `res.on('finish')` listener fires `onHttpRequest(method, path, status, durationMs)` after every HTTP response.
3. **Health poller** – a `setInterval` loop calls `db.healthCheck()` and fires `onDatabaseLatency(label, latencyMs)` for Postgres and Redis.

When a threshold is breached the service:
- Logs at `warn` or `error` level (existing Winston transports pick this up).
- Sends a Slack attachment and/or an HTML email asynchronously.
- Respects a per-alert-key cooldown to prevent notification spam.

### Configuration

All settings are controlled by environment variables. Add them to `.env` (API package):

```dotenv
# Enable performance alerting (disabled by default)
PERF_ALERTING_ENABLED=true

# GraphQL thresholds (ms)
PERF_SLOW_GRAPHQL_WARN_MS=1000
PERF_SLOW_GRAPHQL_CRITICAL_MS=5000

# HTTP request thresholds (ms)
PERF_SLOW_HTTP_WARN_MS=2000
PERF_SLOW_HTTP_CRITICAL_MS=10000

# Database health latency thresholds (ms)
PERF_SLOW_DB_WARN_MS=500
PERF_SLOW_DB_CRITICAL_MS=2000

# Cooldown between identical alerts (ms, default 5 min)
PERF_ALERT_COOLDOWN_MS=300000

# How often to poll /health (ms, default 1 min)
PERF_HEALTH_POLL_INTERVAL_MS=60000

# Slack (reuses indexer webhook variable)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Email (reuses indexer SMTP variables)
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@example.com
EMAIL_SMTP_PASSWORD=your-app-password
EMAIL_FROM_ADDRESS=api@stellar-analytics.local
EMAIL_TO_ADDRESSES=ops@example.com,team@example.com
```

### Alert format

#### Slack
Color-coded attachment (orange = warn, red = critical) with fields:
- Duration / Threshold / Category / Timestamp

#### Email
HTML table with all fields; subject line includes severity and operation name.

---

## Frontend-Side Alerting

### How it works

`usePerformanceMonitor()` is mounted once inside `<Layout>` (which wraps every authenticated page).

1. **Apollo Link injection** – prepends a timing `ApolloLink` to the client's link chain. After each operation resolves, the round-trip time is compared against thresholds.
2. **Navigation Timing API** – on mount it reads `PerformanceNavigationTiming.loadEventEnd` to detect slow page loads.

Breaches are surfaced via `useNotifications()`, so the user sees a toast and the notification panel updates.

### Configuration

Set in the frontend `.env` (or `.env.local`):

```dotenv
VITE_PERF_WARN_MS=2000
VITE_PERF_CRITICAL_MS=8000
```

---

## Acceptance Criteria

- [ ] API logs `warn` when a GraphQL operation exceeds `PERF_SLOW_GRAPHQL_WARN_MS`.
- [ ] API logs `error` when a GraphQL operation exceeds `PERF_SLOW_GRAPHQL_CRITICAL_MS`.
- [ ] API sends a Slack/email alert for each threshold breach (respecting cooldown).
- [ ] API health poller detects elevated Postgres/Redis latency and alerts accordingly.
- [ ] Frontend shows a toast notification when an Apollo operation exceeds `VITE_PERF_WARN_MS`.
- [ ] Frontend shows an error toast when an Apollo operation exceeds `VITE_PERF_CRITICAL_MS`.
- [ ] Repeated alerts within the cooldown window are suppressed.
- [ ] All alerting is disabled by default (`PERF_ALERTING_ENABLED` not set).

---

## Testing

### Manual – API

```bash
# Temporarily lower the threshold so any query triggers it
PERF_ALERTING_ENABLED=true PERF_SLOW_GRAPHQL_WARN_MS=0 pnpm --filter @stellar-analytics/api dev:start
# Send any GraphQL query → alert fires immediately
```

### Manual – Frontend

```bash
VITE_PERF_WARN_MS=0 pnpm --filter @stellar-analytics/frontend dev
# Open the dashboard → toast appears for every Apollo operation
```

### Unit tests

```bash
pnpm --filter @stellar-analytics/api test -- --testPathPattern=performance-alerting
```

---

## See Also

- [Operational SLO Dashboards](./operational-slo-dashboards.md)
- [Error Handling and Logging](./error-handling-and-logging.md)
- [Query Performance](./query-performance.md)
- Indexer alerting: `packages/indexer/src/alerting/` and `indexer/ALERTING.md`
