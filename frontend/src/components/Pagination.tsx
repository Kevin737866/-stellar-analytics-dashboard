/**
 * Pagination component with cursor-based pagination support
 *
 * Features:
 * - Page size selection
 * - Page navigation (prev/next, page numbers)
 * - Infinite scroll option
 * - Reusable for any cursor-based paginated data
 */
import React, { useState, useEffect, useRef } from "react";

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface PaginationProps {
  /** Total number of items */
  totalCount: number;
  /** Current page info from GraphQL */
  pageInfo: PageInfo;
  /** Current page size */
  pageSize: number;
  /** Callback when page size changes */
  onPageSizeChange: (size: number) => void;
  /** Callback to load next page */
  onLoadNext: (cursor: string | null) => void;
  /** Callback to load previous page */
  onLoadPrevious: (cursor: string | null) => void;
  /** Enable infinite scroll mode */
  enableInfiniteScroll?: boolean;
  /** Current cursor for navigation */
  currentCursor: string | null;
  /** Previous cursors for backward navigation */
  previousCursors: string[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function Pagination({
  totalCount,
  pageInfo,
  pageSize,
  onPageSizeChange,
  onLoadNext,
  onLoadPrevious,
  enableInfiniteScroll = false,
  currentCursor,
  previousCursors,
}: PaginationProps) {
  const [isInfiniteScroll, setIsInfiniteScroll] = useState(enableInfiniteScroll);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Calculate current page number (approximate for cursor-based)
  const currentPage = previousCursors.length + 1;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Infinite scroll observer
  useEffect(() => {
    if (!isInfiniteScroll) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pageInfo.hasNextPage) {
          onLoadNext(pageInfo.endCursor);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [isInfiniteScroll, pageInfo.hasNextPage, pageInfo.endCursor, onLoadNext]);

  const handlePrevious = () => {
    const prevCursor = previousCursors[previousCursors.length - 2];
    onLoadPrevious(prevCursor || null);
  };

  const handleNext = () => {
    onLoadNext(pageInfo.endCursor);
  };

  // Don't render pagination controls in infinite scroll mode
  if (isInfiniteScroll) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
              Items per page:
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                style={{
                  marginLeft: "8px",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border)",
                  fontSize: "13px",
                }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            onClick={() => setIsInfiniteScroll(false)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-card-background)",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Switch to Page Navigation
          </button>
        </div>
        <div ref={loadMoreRef} style={{ height: "20px" }} />
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
      {/* Page size and mode toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Items per page:
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                marginLeft: "8px",
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid var(--color-border)",
                fontSize: "13px",
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Showing {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()}
          </span>
        </div>
        <button
          onClick={() => setIsInfiniteScroll(true)}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid var(--color-border)",
            background: "var(--color-card-background)",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Enable Infinite Scroll
        </button>
      </div>

      {/* Navigation controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: currentPage === 1 ? "1px solid var(--color-border-light)" : "1px solid var(--color-border)",
            background: currentPage === 1 ? "var(--color-hover)" : "var(--color-card-background)",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            fontSize: "13px",
            color: currentPage === 1 ? "var(--color-text-muted)" : "var(--color-text-primary)",
          }}
        >
          Previous
        </button>

        {/* Page numbers */}
        <div style={{ display: "flex", gap: "4px" }}>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => {
                  // For cursor-based pagination, we'd need to track all cursors
                  // This is a simplified version - in production, you'd want to store
                  // a map of page numbers to cursors
                  if (pageNum === currentPage) return;
                  // Navigate to page (implementation depends on cursor storage)
                }}
                disabled={pageNum === currentPage}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: pageNum === currentPage ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                  background: pageNum === currentPage ? "var(--color-primary)" : "var(--color-card-background)",
                  cursor: pageNum === currentPage ? "default" : "pointer",
                  fontSize: "13px",
                  color: pageNum === currentPage ? "#fff" : "var(--color-text-primary)",
                  minWidth: "32px",
                }}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNext}
          disabled={!pageInfo.hasNextPage}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: !pageInfo.hasNextPage ? "1px solid var(--color-border-light)" : "1px solid var(--color-border)",
            background: !pageInfo.hasNextPage ? "var(--color-hover)" : "var(--color-card-background)",
            cursor: !pageInfo.hasNextPage ? "not-allowed" : "pointer",
            fontSize: "13px",
            color: !pageInfo.hasNextPage ? "var(--color-text-muted)" : "var(--color-text-primary)",
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
