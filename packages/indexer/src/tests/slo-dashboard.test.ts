import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../');

describe('Operational SLO Dashboards Audit (#487)', () => {
  const dashboardPath = path.join(REPO_ROOT, 'operations/dashboards/operational-slo-dashboard.json');
  const rulesPath = path.join(REPO_ROOT, 'operations/prometheus/slo-rules.yml');
  const docPath = path.join(REPO_ROOT, 'docs/operational-slo-dashboards.md');

  describe('Grafana Dashboard Definition', () => {
    it('verifies that the dashboard JSON file exists and is valid JSON', () => {
      assert.strictEqual(fs.existsSync(dashboardPath), true, 'Dashboard file must exist');
      const raw = fs.readFileSync(dashboardPath, 'utf8');
      assert.doesNotThrow(() => JSON.parse(raw), 'Dashboard must be valid JSON');
    });

    it('conforms to Grafana dashboard schema standards', () => {
      const data = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));
      assert.strictEqual(data.schemaVersion >= 30, true, 'Schema version must be 30 or higher');
      assert.strictEqual(data.uid, 'operational-slo-dashboard');
      assert.strictEqual(typeof data.title, 'string');
      assert.strictEqual(Array.isArray(data.panels), true);
      assert.strictEqual(data.panels.length >= 10, true, 'Must have comprehensive panel coverage');
    });

    it('contains all 5 operational SLO panel groups and targets', () => {
      const data = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));
      const panelTitles = data.panels.map((p: any) => p.title);

      // Verify row headers
      assert.ok(panelTitles.some((t: string) => /Executive Summary/i.test(t)));
      assert.ok(panelTitles.some((t: string) => /API Availability/i.test(t)));
      assert.ok(panelTitles.some((t: string) => /API Latency/i.test(t)));
      assert.ok(panelTitles.some((t: string) => /Ingestion Freshness/i.test(t)));
      assert.ok(panelTitles.some((t: string) => /Ingestion Reliability.*DLQ/i.test(t)));
      assert.ok(panelTitles.some((t: string) => /Database Health/i.test(t)));
    });

    it('references registered indexer and API prometheus metrics', () => {
      const raw = fs.readFileSync(dashboardPath, 'utf8');
      assert.match(raw, /http_requests_total/, 'Must query http_requests_total');
      assert.match(raw, /graphql_query_duration_seconds_bucket/, 'Must query graphql query latency');
      assert.match(raw, /indexer_last_processed_ledger_sequence/, 'Must query indexer sequence');
      assert.match(raw, /indexer_cycle_duration_seconds_bucket/, 'Must query cycle duration');
      assert.match(raw, /indexer_dlq_depth/, 'Must query DLQ depth');
      assert.match(raw, /indexer_circuit_breaker_state/, 'Must query circuit breaker');
      assert.match(raw, /db_pool_active_connections/, 'Must query db pool connections');
    });
  });

  describe('Prometheus Alerting & Recording Rules', () => {
    it('verifies that the alerting rules YAML file exists', () => {
      assert.strictEqual(fs.existsSync(rulesPath), true, 'Prometheus rules file must exist');
    });

    it('defines multi-window multi-burn-rate recording and alert rules', () => {
      const content = fs.readFileSync(rulesPath, 'utf8');
      assert.match(content, /job:http_requests:error_rate1h/, 'Must record 1h error rate');
      assert.match(content, /job:http_requests:error_rate6h/, 'Must record 6h error rate');
      assert.match(content, /ApiAvailabilitySloCriticalBurnRate/, 'Must have critical burn rate alert');
      assert.match(content, /ApiLatencySloBreached/, 'Must have latency SLO breach alert');
      assert.match(content, /IndexerIngestionLagSloBreached/, 'Must have ingestion lag SLO alert');
      assert.match(content, /IndexerDeadLetterQueueNonZero/, 'Must alert on DLQ accumulation');
    });
  });

  describe('Operational SLO Documentation', () => {
    it('verifies that docs/operational-slo-dashboards.md exists', () => {
      assert.strictEqual(fs.existsSync(docPath), true, 'SLO doc must exist');
    });

    it('documents all SLIs, targets, error budgets, and runbook escalation links', () => {
      const content = fs.readFileSync(docPath, 'utf8');
      assert.match(content, /99\.9%/, 'Must document 99.9% availability target');
      assert.match(content, /< 500ms/, 'Must document P95 latency target');
      assert.match(content, /(\u2264|<=)\s*2 ledgers/i, 'Must document 2 ledgers lag target');
      assert.match(content, /99\.99%/, 'Must document 99.99% ingestion reliability target');
      assert.match(content, /Error Budget Policies/, 'Must document error budget policy');
      assert.match(content, /incident-response-runbook\.md/, 'Must cross-link to incident response runbook');
    });
  });
});
