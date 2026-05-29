/**
 * LedgersList component with pagination support
 *
 * Displays a paginated list of ledgers using cursor-based pagination
 * from the GraphQL API.
 */
import { useQuery } from "@apollo/client";
import { LEDGERS_QUERY } from "../graphql/queries";
import { Pagination, PageInfo } from "./Pagination";
import { useState } from "react";

interface LedgerEdge {
  cursor: string;
  node: {
    id: string;
    sequence: number;
    successfulTransactionCount: number;
    failedTransactionCount: number;
    operationCount: number;
    closedAt: string;
  };
}

interface LedgersData {
  ledgers: {
    edges: LedgerEdge[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

export function LedgersList() {
  const [pageSize, setPageSize] = useState(25);
  const [after, setAfter] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<string[]>([]);

  const { data, loading, error, fetchMore } = useQuery<LedgersData>(LEDGERS_QUERY, {
    variables: {
      first: pageSize,
      after,
    },
    notifyOnNetworkStatusChange: true,
  });

  const ledgers = data?.ledgers.edges.map((edge) => edge.node) || [];
  const pageInfo = data?.ledgers.pageInfo || { hasNextPage: false, endCursor: null };
  const totalCount = data?.ledgers.totalCount || 0;

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setAfter(null);
    setPreviousCursors([]);
  };

  const handleLoadNext = (cursor: string | null) => {
    if (cursor && pageInfo.hasNextPage) {
      setPreviousCursors([...previousCursors, after || ""]);
      setAfter(cursor);
    }
  };

  const handleLoadPrevious = (cursor: string | null) => {
    if (previousCursors.length > 0) {
      const newPreviousCursors = previousCursors.slice(0, -1);
      setPreviousCursors(newPreviousCursors);
      setAfter(newPreviousCursors[newPreviousCursors.length - 1] || null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  if (loading && !data) {
    return (
      <section className="card" aria-busy="true">
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>
          Ledgers
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                padding: "12px",
                background: "var(--color-skeleton)",
                borderRadius: "8px",
                height: "80px",
              }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (error && !data) {
    return (
      <section className="card" role="alert">
        <h3 style={{ margin: "0 0 8px", fontSize: "16px", fontWeight: 700 }}>
          Ledgers
        </h3>
        <p style={{ margin: 0, fontSize: "13px", color: "var(--color-error)" }}>
          {error.message}
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>
        Ledgers
      </h3>

      {ledgers.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
          No ledgers available yet. The indexer may still be syncing.
        </p>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "2px solid var(--color-border-light)",
                    textAlign: "left",
                  }}
                >
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Sequence
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Successful Tx
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Failed Tx
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Operations
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Closed At
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledgers.map((ledger) => (
                  <tr
                    key={ledger.id}
                    style={{
                      borderBottom: "1px solid var(--color-border-light)",
                    }}
                  >
                    <td style={{ padding: "8px", fontVariantNumeric: "tabular-nums" }}>
                      #{ledger.sequence}
                    </td>
                    <td style={{ padding: "8px", fontVariantNumeric: "tabular-nums" }}>
                      {ledger.successfulTransactionCount.toLocaleString()}
                    </td>
                    <td style={{ padding: "8px", fontVariantNumeric: "tabular-nums" }}>
                      {ledger.failedTransactionCount.toLocaleString()}
                    </td>
                    <td style={{ padding: "8px", fontVariantNumeric: "tabular-nums" }}>
                      {ledger.operationCount.toLocaleString()}
                    </td>
                    <td style={{ padding: "8px", color: "var(--color-text-secondary)" }}>
                      {formatDate(ledger.closedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            totalCount={totalCount}
            pageInfo={pageInfo}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            onLoadNext={handleLoadNext}
            onLoadPrevious={handleLoadPrevious}
            currentCursor={after}
            previousCursors={previousCursors}
          />
        </>
      )}
    </section>
  );
}
