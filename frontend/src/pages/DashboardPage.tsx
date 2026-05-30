/**
 * DashboardPage (issue #49)
 *
 * Replaces stub data with real API calls via useDashboardData.
 * Handles loading states, API errors, and retry logic.
 * Now includes paginated list views for ledgers and transactions.
 */
import { TransactionsChart } from "../components/TransactionsChart";
import { ExportControls } from "../components/ExportControls";
import { ThemeToggle } from "../components/ThemeToggle";
import { useDashboardData } from "../hooks/useDashboardData";
import { statsToArray } from "../utils/exportUtils";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { LedgersList } from "../components/LedgersList";
import { TransactionsList } from "../components/TransactionsList";
import { useLocaleFormat } from "../utils/localeUtils";

export function DashboardPage() {
  const { t } = useTranslation();
  const { formatNumber } = useLocaleFormat();
  const { data, loading, error, retry } = useDashboardData();
  const [activeTab, setActiveTab] = useState<"dashboard" | "ledgers" | "transactions">("dashboard");

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <main className="app">
        <h1>{t('app.title')}</h1>
        <div className="grid">
          {[0, 1, 2, 3].map((i) => (
            <article key={i} className="card skeleton" aria-busy="true">
              <div className="skeleton-line" style={{ width: "60%", height: "14px", marginBottom: "8px" }} />
              <div className="skeleton-line" style={{ width: "40%", height: "28px" }} />
            </article>
          ))}
        </div>
      </main>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <main className="app">
        <h1>{t('app.title')}</h1>
        <div
          role="alert"
          style={{
            background: "var(--color-error-bg)",
            border: "1px solid var(--color-error-border)",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: "0 0 8px", color: "var(--color-error)", fontSize: "16px" }}>
            {t('errors.failedToLoad')}
          </h2>
          <p style={{ margin: "0 0 12px", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            {error.message}
          </p>
          <button
            onClick={retry}
            style={{
              background: "var(--color-error)",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {t('errors.retry')}
          </button>
        </div>
      </main>
    );
  }

  // ── Data state ─────────────────────────────────────────────────────────────
  const stats = data!;

  const metrics = [
    { label: t('metrics.totalLedgers'), value: formatNumber(stats.totalLedgers) },
    { label: t('metrics.totalTransactions'), value: formatNumber(stats.totalTransactions) },
    { label: t('metrics.totalOperations'), value: formatNumber(stats.totalOperations) },
    { label: t('metrics.totalAccounts'), value: formatNumber(stats.totalAccounts) },
    { label: t('metrics.activeAccounts24h'), value: formatNumber(stats.activeAccounts24h) },
    { label: t('metrics.volume24h'), value: stats.volume24h },
    { label: t('metrics.avgFee24h'), value: `${formatNumber(stats.averageFee24h, { maximumFractionDigits: 0 })} str` },
    { label: t('metrics.successRate24h'), value: `${formatNumber(stats.successRate24h, { maximumFractionDigits: 1 })}%` },
  ];

  return (
    <main className="app">
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ margin: 0 }}>{t('app.title')}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--color-text-secondary)", fontSize: "14px" }}>
            {t('app.network')}:{" "}
            <strong style={{ textTransform: "capitalize" }}>{stats.network}</strong>
            {stats.latestLedger !== null && (
              <> &nbsp;·&nbsp; {t('app.latestLedger')}: <strong>#{stats.latestLedger}</strong></>
            )}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Theme toggle */}
          <ThemeToggle />
          
          {/* Export controls for dashboard metrics */}
          <ExportControls 
            data={statsToArray(stats)} 
            baseFilename="dashboard-metrics"
            disabled={loading}
          />
          
          {/* Soft refresh indicator while polling */}
          {loading && (
            <span
              aria-label="Refreshing data"
              style={{ fontSize: "12px", color: "var(--color-text-tertiary)" }}
            >
              ↻ {t('app.refreshing')}
            </span>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{ marginBottom: "24px", borderBottom: "1px solid var(--color-border-light)" }}>
        <div style={{ display: "flex", gap: "24px" }}>
          <button
            onClick={() => setActiveTab("dashboard")}
            style={{
              padding: "8px 0",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "dashboard" ? "2px solid var(--color-primary)" : "2px solid transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: activeTab === "dashboard" ? 600 : 400,
              color: activeTab === "dashboard" ? "var(--color-primary)" : "var(--color-text-secondary)",
            }}
          >
            {t('tabs.dashboard')}
          </button>
          <button
            onClick={() => setActiveTab("ledgers")}
            style={{
              padding: "8px 0",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "ledgers" ? "2px solid var(--color-primary)" : "2px solid transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: activeTab === "ledgers" ? 600 : 400,
              color: activeTab === "ledgers" ? "var(--color-primary)" : "var(--color-text-secondary)",
            }}
          >
            {t('tabs.ledgers')}
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            style={{
              padding: "8px 0",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "transactions" ? "2px solid var(--color-primary)" : "2px solid transparent",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: activeTab === "transactions" ? 600 : 400,
              color: activeTab === "transactions" ? "var(--color-primary)" : "var(--color-text-secondary)",
            }}
          >
            {t('tabs.transactions')}
          </button>
        </div>
      </div>

      {/* Soft error banner (partial data available) */}
      {error && data && (
        <div
          role="alert"
          style={{
            background: "var(--color-warning-bg)",
            border: "1px solid var(--color-warning-border)",
            borderRadius: "8px",
            padding: "10px 16px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "13px",
          }}
        >
          <span style={{ color: "var(--color-warning-text)" }}>
            {t('errors.couldNotRefresh')}: {error.message}
          </span>
          <button
            onClick={retry}
            style={{
              background: "transparent",
              border: "1px solid var(--color-warning-border)",
              borderRadius: "6px",
              padding: "4px 10px",
              cursor: "pointer",
              color: "var(--color-warning-text)",
              fontSize: "12px",
            }}
          >
            {t('errors.retry')}
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "dashboard" && (
        <>
          <div className="grid">
            {metrics.map(({ label, value }) => (
              <article key={label} className="card">
                <h3 style={{ margin: "0 0 8px", fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-secondary)" }}>
                  {label}
                </h3>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {value}
                </p>
              </article>
            ))}
          </div>

          <div className="grid" style={{ marginTop: "24px" }}>
            <TransactionsChart />
          </div>
        </>
      )}

      {activeTab === "ledgers" && (
        <LedgersList />
      )}

      {activeTab === "transactions" && (
        <TransactionsList />
      )}
    </main>
  );
}
