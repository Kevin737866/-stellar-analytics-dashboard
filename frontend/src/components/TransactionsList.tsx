/**
 * TransactionsList component with pagination support
 *
 * Displays a paginated list of transactions using cursor-based pagination
 * from the GraphQL API.
 */
import { useQuery } from "@apollo/client";
import { TRANSACTIONS_QUERY } from "../graphql/queries";
import { Pagination, PageInfo } from "./Pagination";
import { useState } from "react";

interface TransactionEdge {
  cursor: string;
  node: {
    id: string;
    hash: string;
    successful: boolean;
    ledger: number;
    createdAt: string;
    sourceAccount: string;
    feeCharged: number;
    operationCount: number;
  };
}

interface TransactionsData {
  transactions: {
    edges: TransactionEdge[];
    pageInfo: PageInfo;
    totalCount: number;
  };
}

export function TransactionsList() {
  const [pageSize, setPageSize] = useState(25);
  const [after, setAfter] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<string[]>([]);

  const { data, loading, error, fetchMore } = useQuery<TransactionsData>(
    TRANSACTIONS_QUERY,
    {
      variables: {
        first: pageSize,
        after,
      },
      notifyOnNetworkStatusChange: true,
    }
  );

  const transactions = data?.transactions.edges.map((edge) => edge.node) || [];
  const pageInfo = data?.transactions.pageInfo || { hasNextPage: false, endCursor: null };
  const totalCount = data?.transactions.totalCount || 0;

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

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  const formatAccount = (account: string) => {
    return `${account.slice(0, 8)}...${account.slice(-8)}`;
  };

  if (loading && !data) {
    return (
      <section className="card" aria-busy="true">
        <h3 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: 700 }}>
          Transactions
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
          Transactions
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
        Transactions
      </h3>

      {transactions.length === 0 ? (
        <p style={{ margin: 0, fontSize: "13px", color: "var(--color-text-muted)" }}>
          No transactions available yet. The indexer may still be syncing.
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
                    Hash
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Status
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Ledger
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Source Account
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Fee
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Operations
                  </th>
                  <th style={{ padding: "8px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    style={{
                      borderBottom: "1px solid var(--color-border-light)",
                    }}
                  >
                    <td style={{ padding: "8px", fontFamily: "monospace" }}>
                      {formatHash(tx.hash)}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          background: tx.successful ? "var(--color-success-bg)" : "var(--color-error-bg)",
                          color: tx.successful ? "var(--color-success)" : "var(--color-error)",
                        }}
                      >
                        {tx.successful ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td style={{ padding: "8px", fontVariantNumeric: "tabular-nums" }}>
                      #{tx.ledger}
                    </td>
                    <td style={{ padding: "8px", fontFamily: "monospace" }}>
                      {formatAccount(tx.sourceAccount)}
                    </td>
                    <td style={{ padding: "8px", fontVariantNumeric: "tabular-nums" }}>
                      {tx.feeCharged.toLocaleString()} str
                    </td>
                    <td style={{ padding: "8px", fontVariantNumeric: "tabular-nums" }}>
                      {tx.operationCount}
                    </td>
                    <td style={{ padding: "8px", color: "var(--color-text-secondary)" }}>
                      {formatDate(tx.createdAt)}
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
