/**
 * TransactionsChart (issue #49)
 *
 * Fetches real transaction volume data from the GraphQL API via Apollo Client.
 * Handles loading, error, and empty states gracefully.
 * Falls back to a "no data" message when the API returns an empty array.
 */
import { useQuery } from "@apollo/client";
import { NETWORK_METRICS_QUERY } from "../graphql/queries";
import { ExportControls } from "./ExportControls";

interface MetricPoint {
  timestamp: string;
  transactionCount: number;
  operationCount: number;
  averageFee: number;
  successRate: number;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TransactionsChart() {
  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data, loading, error, refetch } = useQuery(NETWORK_METRICS_QUERY, {
    variables: { timeRange: { startTime, endTime: now.toISOString() } },
    pollInterval: 30_000,
    notifyOnNetworkStatusChange: true,
    errorPolicy: "all",
  });

  const metrics: MetricPoint[] = (data?.networkMetrics ?? []).map((m: any) => ({
    timestamp: m.timestamp,
    transactionCount: m.transactionCount ?? 0,
    operationCount: m.operationCount ?? 0,
    averageFee: m.averageFee ?? 0,
    successRate: m.successRate ?? 0,
  }));

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading && metrics.length === 0) {
    return (
      <section className="card" aria-busy="true" aria-label="Loading transaction chart">
        <h3 style={{ margin: "0 0 12px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
          Transaction Volume (24h)
        </h3>
        <div
          style={{
            height: "120px",
            background: "linear-gradient(90deg, var(--color-skeleton-start) 25%, var(--color-skeleton-end) 50%, var(--color-skeleton-start) 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.5s infinite",
            borderRadius: "8px",
          }}
        />
        <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      </section>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error && metrics.length === 0) {
    return (
      <section className="card" role="alert">
        <h3 style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
          Transaction Volume (24h)
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--color-error)" }}>
          {error.message}
        </p>
        <button
          onClick={() => refetch()}
          style={{
            background: "var(--color-input-disabled)",
            border: "1px solid var(--color-border)",
            borderRadius: "6px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "13px",
            color: "var(--color-text-primary)",
          }}
        >
          Retry
        </button>
      </section>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (metrics.length === 0) {
    return (
      <section className="card">
        <h3 style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
          Transaction Volume (24h)
        </h3>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-tertiary)" }}>
          No data available yet. The indexer may still be syncing.
        </p>
      </section>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const maxTx = Math.max(...metrics.map((m) => m.transactionCount), 1);

  return (
    <section className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
          Transaction Volume (24h)
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {/* Export controls for transaction metrics */}
          <ExportControls 
            data={metrics} 
            baseFilename="transaction-metrics"
            disabled={loading}
          />
          
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {loading && (
              <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>↻ Updating…</span>
            )}
            <button
              onClick={() => refetch()}
              disabled={loading}
              aria-label="Refresh chart"
              style={{
                background: "transparent",
                border: "1px solid var(--color-border)",
                borderRadius: "6px",
                padding: "4px 8px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
              }}
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      {/* Simple bar chart */}
      <div
        role="img"
        aria-label={`Transaction volume chart with ${metrics.length} data points`}
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "2px",
          height: "80px",
          padding: "0 4px",
        }}
      >
        {metrics.map((m, i) => {
          const heightPct = (m.transactionCount / maxTx) * 100;
          return (
            <div
              key={i}
              title={`${formatTime(m.timestamp)}: ${m.transactionCount} txs`}
              style={{
                flex: 1,
                height: `${Math.max(heightPct, 2)}%`,
                background: m.successRate >= 99 ? "var(--color-primary)" : m.successRate >= 95 ? "var(--color-warning)" : "var(--color-error)",
                borderRadius: "2px 2px 0 0",
                transition: "height 0.3s ease",
                minWidth: "2px",
              }}
            />
          );
        })}
      </div>

      {/* X-axis labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
        <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>
          {formatTime(metrics[0].timestamp)}
        </span>
        <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>
          {formatTime(metrics[metrics.length - 1].timestamp)}
        </span>
      </div>

      {/* Summary row */}
      <div style={{ display: "flex", gap: "16px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--color-border)" }}>
        <div>
          <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>Total txs</div>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>
            {metrics.reduce((s, m) => s + m.transactionCount, 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>Avg fee</div>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>
            {(metrics.reduce((s, m) => s + m.averageFee, 0) / metrics.length).toFixed(0)} str
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)" }}>Success rate</div>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>
            {(metrics.reduce((s, m) => s + m.successRate, 0) / metrics.length).toFixed(1)}%
          </div>
        </div>
      </div>

      <p style={{ margin: "8px 0 0", fontSize: "10px", color: "var(--color-text-disabled)" }}>
        {metrics.length} data points · auto-refreshes every 30s
      </p>
    </section>
  );
}
