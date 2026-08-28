# Operational Service Level Objective (SLO) Dashboards

This document defines the production **Service Level Indicators (SLIs)**, **Service Level Objectives (SLOs)**, **Error Budget Policies**, and **Grafana Dashboards** for the Stellar Analytics Dashboard monorepo.

---

## 1. Executive Summary

Service Level Objectives establish quantitative contracts for reliability and performance. When error budgets are healthy, product development proceeds at full speed; when error budgets burn excessively, operational priorities take precedence to restore system health.

### Core Monorepo SLO Summary

| Service Area | Service Level Objective (SLO) | Target | Error Budget (30-day) | SLI Metric Source |
|---|---|---|---|---|
| **API Availability** | Successful HTTP/GraphQL operations | **≥ 99.9%** | 0.1% (~43.2 min downtime) | `http_requests_total{status!~"5.."}` |
| **API Latency** | GraphQL query execution latency | **P95 < 500ms**<br>**P99 < 1500ms** | 5% / 1% slow queries | `graphql_query_duration_seconds` |
| **Ingestion Freshness** | Ingestion lag behind Horizon tip | **≤ 2 ledgers** (<10s)<br>**Cycle < 5s** | 0.5% lag excursions | `stellar_network_latest_ledger - indexer_last_processed_ledger_sequence` |
| **Ingestion Reliability** | Ingestion pipeline success rate | **≥ 99.99%** | 0.01% failed records | `indexer_ledgers_processed_total` vs `indexer_errors_total` |
| **Dead Letter Queue** | Unprocessable transaction quarantine | **0 items** | Zero persistent items | `indexer_dlq_depth` |
| **Database Pool** | PostgreSQL connection pool saturation | **< 80%** active | No pool exhaustion | `db_pool_active_connections / db_pool_max_connections` |

---

## 2. Detailed SLO Specifications

### 2.1 API Availability SLO (99.9%)

- **Description**: Proportion of valid user requests served without HTTP 5xx responses or unhandled internal server errors.
- **SLI Formula**:
  $$\text{Availability SLI} = \frac{\sum \text{rate}(http\_requests\_total\{status ! \sim "5.."\} [30d])}{\sum \text{rate}(http\_requests\_total [30d])} \times 100$$
- **Target**: **≥ 99.9%** across any rolling 30-day window.
- **Error Budget**: 0.10% (equivalent to 43.2 minutes of total outage or 1 in every 1,000 requests failing).

### 2.2 API Latency SLO (P95 < 500ms, P99 < 1500ms)

- **Description**: Speed of GraphQL query processing from Apollo Server receiving the request to sending the response.
- **SLI Formula**:
  $$\text{P95 Latency} = \text{histogram\_quantile}(0.95, \sum \text{rate}(graphql\_query\_duration\_seconds\_bucket[5m]) \text{ by } (le))$$
- **Target**:
  - **95%** of all queries resolved in **< 500ms**.
  - **99%** of all queries resolved in **< 1500ms**.
- **Exclusions**: Intentionally long-running admin queries requiring background processing.

### 2.3 Indexer Ingestion Freshness & Lag SLO (≤ 2 Ledgers)

- **Description**: The latency between a ledger closing on the Stellar blockchain and its data being stored and queryable in Postgres.
- **SLI Formula**:
  $$\text{Ledger Lag} = stellar\_network\_latest\_ledger - indexer\_last\_processed\_ledger\_sequence$$
- **Target**: Ledger lag **≤ 2 ledgers** for ≥ 99.5% of 5-minute sampling periods under normal Horizon network operation.
- **Ingestion Cycle Target**: `P99` cycle duration **< 5 seconds** (ensures indexer outpaces Stellar's ~5s block close time).

### 2.4 Ingestion Reliability & DLQ SLO (99.99%)

- **Description**: Ingested transactions and operations must parse, validate, and write idempotently without unrecoverable drops.
- **Target**:
  - **99.99%** of valid network operations ingested on first pass.
  - **Zero** unrecoverable transactions lingering in the Dead Letter Queue (`indexer_dlq_depth == 0`).
- **DLQ Policy**: Items in DLQ generate an operational notification within 5 minutes.

### 2.5 Database & Infrastructure Health SLO

- **Description**: PostgreSQL connection pool and query engine health.
- **Targets**:
  - Pool utilization: `(db_pool_active_connections / db_pool_max_connections) * 100 < 80%`.
  - Database Write Duration: `P95` write duration `< 50ms` per ledger batch.

---

## 3. Grafana Dashboard Architecture

The production dashboard definition is versioned in:
`operations/dashboards/operational-slo-dashboard.json`

### Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Operational SLO Executive Summary                                   │
│  [ Availability: 99.95% ]  [ P95: 142ms ]  [ Lag: 0 ]  [ DLQ: 0 ]      │
├────────────────────────────────────────────────────────────────────────┤
│ 2. API Availability & Error Budget Burn Rate                           │
│  [ 30d Rolling Availability SLI ]   [ Multi-Window Burn Rates (1h/6h) ]│
├────────────────────────────────────────────────────────────────────────┤
│ 3. API Latency & Query Performance SLO                                 │
│  [ Query Latency Percentiles (P50/P95/P99) ]  [ Slow Query Breaches ]  │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Indexer Ingestion Freshness & Throughput SLO                        │
│  [ Ingestion Ledger Lag ]            [ Cycle Duration Percentiles ]    │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Ingestion Reliability & DLQ Management SLO                          │
│  [ DLQ Depth & Inflow Rate ]         [ Circuit Breaker State ]         │
├────────────────────────────────────────────────────────────────────────┤
│ 6. Infrastructure & Database Health SLO                                │
│  [ PostgreSQL Connection Pool % ]    [ DB Write Duration by Table ]    │
└────────────────────────────────────────────────────────────────────────┘
```

### Importing into Grafana

1. **Manual Import**:
   - Open Grafana UI -> **Dashboards** -> **New** -> **Import**.
   - Upload `operations/dashboards/operational-slo-dashboard.json` or paste the JSON content.
   - Select your Prometheus data source when prompted.
2. **Automated Provisioning**:
   Add to Grafana provisioning configuration (`/etc/grafana/provisioning/dashboards/dashboards.yaml`):
   ```yaml
   apiVersion: 1
   providers:
     - name: 'operations'
       orgId: 1
       folder: 'Operations'
       type: file
       disableDeletion: false
       updateIntervalSeconds: 30
       options:
         path: /var/lib/grafana/dashboards/operations
   ```

---

## 4. Multi-Window Multi-Burn-Rate Alerting

Following Google SRE best practices, alerts are evaluated across short and long time windows to balance **high precision** (no alert fatigue) and **high recall** (immediate notification of catastrophic outages).

Rules are located in `operations/prometheus/slo-rules.yml`:

| Alert Name | Severity | Window | Burn Rate | % Budget Consumed | Notification Channel | Action |
|---|---|---|---|---|---|---|
| `ApiAvailabilitySloCriticalBurnRate` | **Critical** | 1 hour | **14.4×** | 2% in 1 hour | PagerDuty (Page) | Immediate engineer paging; initiate SEV-2 incident. |
| `ApiAvailabilitySloElevatedBurnRate` | **Warning** | 6 hours | **6.0×** | 5% in 6 hours | Slack (`#ops-alerts`) | On-call engineer investigation within 2 hours. |
| `ApiLatencySloBreached` | **Warning** | 5 mins | N/A | P95 > 500ms | Slack (`#ops-alerts`) | Check slow query logs and DB pool metrics. |
| `IndexerIngestionLagSloBreached` | **Warning** | 5 mins | N/A | Lag > 2 ledgers | Slack (`#ops-alerts`) | Verify Horizon stream health and DB writes. |
| `IndexerIngestionLagCritical` | **Critical** | 3 mins | N/A | Lag > 10 ledgers | PagerDuty (Page) | Check for network split or crashed indexer service. |
| `IndexerDeadLetterQueueNonZero` | **Warning** | 5 mins | N/A | DLQ > 0 | Slack (`#ops-alerts`) | Inspect payload in DLQ; check schema validation. |

---

## 5. Error Budget Policies

When the 30-day rolling error budget falls below threshold levels:

- **> 50% Error Budget Remaining**: Normal operations; feature releases and migrations proceed unrestricted.
- **25% - 50% Remaining**: Reliability review required for any non-essential database migrations or schema alterations.
- **< 25% Remaining**: Feature freeze on affected component; development velocity redirects toward bug fixing, index optimization, and query tuning.
- **0% (Exhausted)**: Code freeze. No deployments permitted except critical hotfixes aimed directly at restoring the SLO.

---

## 6. Incident & Runbook Integration

When an SLO alert triggers:

1. **High Query Latency**: Follow [docs/incident-response-runbook.md §5.8 (Slow GraphQL Queries)](./incident-response-runbook.md#58-slow-graphql-queries--high-latency).
2. **Ingestion Lag**: Follow [docs/incident-response-runbook.md §5.1 (Horizon Disconnection)](./incident-response-runbook.md#51-horizon-stream-disconnection).
3. **Database Saturation**: Follow [docs/query-performance.md](./query-performance.md) and [docs/performance-alerting.md](./performance-alerting.md).
