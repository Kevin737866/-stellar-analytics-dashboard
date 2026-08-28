import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useLazyQuery } from '@apollo/client';
import { TRANSACTIONS_QUERY, TRANSACTIONS_EXPORT_QUERY } from '@/graphql/queries';
import { DataTable } from '@/components/DataTable';
import { FilterBar, FilterRow, ToggleGroup, RangeInput, DateRangeInput } from '@/components/FilterBar';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Search, RefreshCcw, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFilterSort } from '@/hooks/useFilterSort';
import type { FilterPreset } from '@/components/FilterBar';
import { transactionFiltersSchema } from '@/lib/validation';
import { clsx } from 'clsx';
import { ApiErrorMessage } from '@/components/ApiErrorMessage';

// ── filter defaults ──────────────────────────────────────────────────────────

const DEFAULTS = {
  search: '',
  successful: '' as '' | 'true' | 'false',
  hasMemo: '' as '' | 'true' | 'false',
  memoType: '',
  minFee: '',
  maxFee: '',
  startTime: '',
  endTime: '',
};

type TxFilters = typeof DEFAULTS;

// ── export format ────────────────────────────────────────────────────────────

type ExportFormat = 'csv' | 'json';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildGqlFilter(filters: TxFilters) {
  const f: Record<string, unknown> = {};
  if (filters.successful === 'true') f.successful = true;
  if (filters.successful === 'false') f.successful = false;
  if (filters.hasMemo === 'true') f.hasMemo = true;
  if (filters.hasMemo === 'false') f.hasMemo = false;
  if (filters.memoType) f.memoType = filters.memoType;
  if (filters.minFee) f.minFee = parseInt(filters.minFee);
  if (filters.maxFee) f.maxFee = parseInt(filters.maxFee);
  return Object.keys(f).length ? f : undefined;
}

function buildTimeRange(filters: TxFilters) {
  if (!filters.startTime && !filters.endTime) return undefined;
  return {
    startTime: filters.startTime || undefined,
    endTime: filters.endTime || undefined,
  };
}

function clientSort(txs: any[], field: string, dir: 'asc' | 'desc') {
  return [...txs].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;
    switch (field) {
      case 'createdAt':
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
        break;
      case 'feeCharged':
        av = a.feeCharged;
        bv = b.feeCharged;
        break;
      case 'operationCount':
        av = a.operationCount;
        bv = b.operationCount;
        break;
      case 'ledger':
        av = a.ledger;
        bv = b.ledger;
        break;
      default:
        return 0;
    }
    return dir === 'asc' ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
  });
}

/**
 * Flatten a transaction node into a plain record suitable for CSV/JSON export.
 * Keeps only the fields that are meaningful to an end user.
 */
function flattenTransaction(tx: any): Record<string, unknown> {
  return {
    hash: tx.hash,
    successful: tx.successful,
    ledger: tx.ledger,
    sourceAccount: tx.sourceAccount,
    feeCharged: tx.feeCharged,
    operationCount: tx.operationCount,
    memoType: tx.memoType ?? '',
    memo: tx.memo ?? '',
    createdAt: tx.createdAt,
  };
}

/** Convert an array of plain records to a RFC-4180-compliant CSV string. */
function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
  ].join('\n');
}

/** Trigger a browser file download for the given text content. */
function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Generate a timestamped filename, e.g. `transactions-2026-06-01T12-00-00.csv`. */
function makeFilename(base: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${base}-${ts}.${ext}`;
}

// ── component ────────────────────────────────────────────────────────────────

export function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterErrors, setFilterErrors] = useState<Record<string, string>>({});
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { filters, sort, setFilter, setSort, resetFilters, activeCount } =
    useFilterSort<TxFilters>({
      defaults: DEFAULTS,
      sortDefaults: { field: 'createdAt', dir: 'desc' },
    });

  const after = searchParams.get('after') ?? undefined;

  // ── main paginated query ───────────────────────────────────────────────────

  const { data, loading, error, refetch } = useQuery(TRANSACTIONS_QUERY, {
    variables: {
      first: 20,
      after,
      filter: buildGqlFilter(filters),
      timeRange: buildTimeRange(filters),
    },
    pollInterval: 10000,
    notifyOnNetworkStatusChange: true,
  });

  // ── export query (lazy, network-only, up to 1 000 rows) ───────────────────
  //
  // We use a separate lazy query so the export fetch never pollutes the
  // paginated cache and doesn't block the UI while the user browses.

  const [fetchExport] = useLazyQuery(TRANSACTIONS_EXPORT_QUERY, {
    fetchPolicy: 'network-only',
  });

  // Refetch when filters change (reset cursor to page 1)
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      prevFiltersRef.current = filters;
      refetch({
        first: 20,
        after: undefined,
        filter: buildGqlFilter(filters),
        timeRange: buildTimeRange(filters),
      });
    }
  }, [filters, refetch]);

  const rawTxs = data?.transactions?.edges.map((e: any) => e.node) ?? [];
  const pageInfo = data?.transactions?.pageInfo;
  const totalCount = data?.transactions?.totalCount;

  // Client-side search (hash / source account)
  const searched = filters.search
    ? rawTxs.filter(
        (tx: any) =>
          tx.hash.toLowerCase().includes(filters.search.toLowerCase()) ||
          tx.sourceAccount.toLowerCase().includes(filters.search.toLowerCase())
      )
    : rawTxs;

  const sorted = clientSort(searched, sort.field, sort.dir);

  // ── export handler ─────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await fetchExport({
        variables: {
          first: 1000,
          filter: buildGqlFilter(filters),
          timeRange: buildTimeRange(filters),
        },
      });

      const nodes: any[] =
        result.data?.transactions?.edges?.map((e: any) => e.node) ?? [];

      if (nodes.length === 0) {
        setExportError('No transactions match the current filters.');
        return;
      }

      const rows = nodes.map(flattenTransaction);

      if (exportFormat === 'csv') {
        triggerDownload(
          toCSV(rows),
          makeFilename('transactions', 'csv'),
          'text/csv;charset=utf-8;'
        );
      } else {
        triggerDownload(
          JSON.stringify(rows, null, 2),
          makeFilename('transactions', 'json'),
          'application/json;charset=utf-8;'
        );
      }
    } catch (err: any) {
      setExportError(err?.message ?? 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [fetchExport, filters, exportFormat]);

  // ── filter validation ──────────────────────────────────────────────────────

  const validateFilters = (updated: TxFilters) => {
    const result = transactionFiltersSchema.safeParse(updated);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        const key = e.path[0] as string;
        errs[key] = e.message;
      });
      setFilterErrors(errs);
    } else {
      setFilterErrors({});
    }
  };

  // ── presets ────────────────────────────────────────────────────────────────

  const presets: FilterPreset[] = [
    {
      label: 'Successful only',
      description: 'Show only successful transactions',
      apply: () => { resetFilters(); setFilter('successful', 'true'); },
    },
    {
      label: 'Failed only',
      description: 'Show only failed transactions',
      apply: () => { resetFilters(); setFilter('successful', 'false'); },
    },
    {
      label: 'With memo',
      description: 'Transactions that carry a memo',
      apply: () => { resetFilters(); setFilter('hasMemo', 'true'); },
    },
    {
      label: 'High fee (>1000)',
      description: 'Fee charged above 1000 stroops',
      apply: () => { resetFilters(); setFilter('minFee', '1000'); },
    },
    {
      label: 'Last 24h',
      description: 'Transactions from the last 24 hours',
      apply: () => {
        resetFilters();
        const start = new Date(Date.now() - 24 * 60 * 60 * 1000);
        setFilter('startTime', start.toISOString().slice(0, 16));
      },
    },
  ];

  // ── table columns ──────────────────────────────────────────────────────────

  const columns = [
    {
      header: 'Status',
      accessor: (tx: any) =>
        tx.successful ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" aria-label="Successful" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" aria-label="Failed" />
        ),
    },
    {
      header: 'Hash',
      accessor: (tx: any) => (
        <Link
          to={`/transactions/${tx.hash}`}
          className="text-primary font-mono hover:underline font-bold"
        >
          {tx.hash.slice(0, 8)}…{tx.hash.slice(-8)}
        </Link>
      ),
    },
    {
      header: 'Ledger',
      sortField: 'ledger',
      accessor: (tx: any) => <span className="font-mono">#{tx.ledger}</span>,
    },
    {
      header: 'Source Account',
      accessor: (tx: any) => (
        <span className="text-muted-foreground font-mono text-xs">
          {tx.sourceAccount.slice(0, 12)}…
        </span>
      ),
    },
    {
      header: 'Ops',
      sortField: 'operationCount',
      accessor: (tx: any) => (
        <span className="font-medium tabular-nums">{tx.operationCount}</span>
      ),
      className: 'text-center',
    },
    {
      header: 'Fee (stroops)',
      sortField: 'feeCharged',
      accessor: (tx: any) => (
        <span className="font-mono tabular-nums">{tx.feeCharged?.toLocaleString()}</span>
      ),
      className: 'text-right',
    },
    {
      header: 'Age',
      sortField: 'createdAt',
      accessor: (tx: any) =>
        formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true }),
      className: 'text-right',
    },
  ];

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <p className="text-muted-foreground text-sm font-medium">Live network activity</p>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Sync button */}
          <button
            onClick={() => refetch()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-60"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Sync Now
          </button>

          {/* ── Export controls ─────────────────────────────────────────── */}
          <div
            className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5"
            role="group"
            aria-label="Export transactions"
          >
            {/* Format selector */}
            <select
              id="export-format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              disabled={isExporting}
              aria-label="Select export format"
              className="text-sm bg-transparent border-none outline-none cursor-pointer text-foreground disabled:opacity-50"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>

            {/* Export button */}
            <button
              onClick={handleExport}
              disabled={isExporting}
              aria-label={
                isExporting
                  ? 'Exporting transactions…'
                  : `Export transactions as ${exportFormat.toUpperCase()}`
              }
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors',
                isExporting
                  ? 'bg-primary/60 text-primary-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Download
                size={14}
                aria-hidden="true"
                className={isExporting ? 'animate-bounce' : ''}
              />
              {isExporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Export error banner ───────────────────────────────────────────── */}
      {exportError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm"
        >
          <span>{exportError}</span>
          <button
            onClick={() => setExportError(null)}
            aria-label="Dismiss export error"
            className="shrink-0 text-destructive/70 hover:text-destructive transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Search bar ───────────────────────────────────────────────────── */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={16}
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder="Search by hash or source account…"
          aria-label="Search transactions"
          className={clsx(
            'w-full pl-9 pr-4 py-2.5 bg-card border rounded-xl focus:outline-none focus:ring-2 text-sm',
            filterErrors.search
              ? 'border-destructive focus:ring-destructive/30'
              : 'border-border focus:ring-primary/30'
          )}
          value={filters.search}
          onChange={(e) => {
            setFilter('search', e.target.value);
            if (filterErrors.search) setFilterErrors((prev) => ({ ...prev, search: '' }));
          }}
        />
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <FilterBar
        activeCount={activeCount}
        onReset={() => { resetFilters(); setFilterErrors({}); }}
        presets={presets}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <FilterRow label="Status">
            <ToggleGroup
              options={[
                { label: 'Any', value: '' },
                { label: 'Successful', value: 'true' },
                { label: 'Failed', value: 'false' },
              ]}
              value={filters.successful}
              onChange={(v) => setFilter('successful', v as string)}
            />
          </FilterRow>

          <FilterRow label="Memo">
            <ToggleGroup
              options={[
                { label: 'Any', value: '' },
                { label: 'Has memo', value: 'true' },
                { label: 'No memo', value: 'false' },
              ]}
              value={filters.hasMemo}
              onChange={(v) => setFilter('hasMemo', v as string)}
            />
          </FilterRow>

          <FilterRow label="Memo type">
            <select
              value={filters.memoType}
              onChange={(e) => setFilter('memoType', e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              aria-label="Filter by memo type"
            >
              <option value="">Any</option>
              <option value="none">None</option>
              <option value="text">Text</option>
              <option value="id">ID</option>
              <option value="hash">Hash</option>
              <option value="return">Return</option>
            </select>
          </FilterRow>

          <FilterRow label="Fee (stroops)">
            <RangeInput
              minValue={filters.minFee}
              maxValue={filters.maxFee}
              onMinChange={(v) => {
                setFilter('minFee', v);
                validateFilters({ ...filters, minFee: v });
              }}
              onMaxChange={(v) => {
                setFilter('maxFee', v);
                validateFilters({ ...filters, maxFee: v });
              }}
              placeholder={{ min: '0', max: '∞' }}
              maxError={filterErrors.maxFee}
            />
          </FilterRow>

          <FilterRow label="Time range">
            <DateRangeInput
              startValue={filters.startTime}
              endValue={filters.endTime}
              onStartChange={(v) => {
                setFilter('startTime', v);
                validateFilters({ ...filters, startTime: v });
              }}
              onEndChange={(v) => {
                setFilter('endTime', v);
                validateFilters({ ...filters, endTime: v });
              }}
              endError={filterErrors.endTime}
            />
          </FilterRow>
        </div>
      </FilterBar>

      {/* ── Data table ───────────────────────────────────────────────────── */}
      {error ? (
        <ApiErrorMessage error={error} onRetry={() => refetch()} />
      ) : (
      <DataTable
        caption="Transactions"
        columns={columns}
        data={sorted}
        loading={loading}
        sort={sort}
        onSort={setSort}
        totalCount={totalCount}
        hasNextPage={pageInfo?.hasNextPage}
        hasPrevPage={pageInfo?.hasPreviousPage}
        onNextPage={() => {
          setSearchParams((p) => {
            const n = new URLSearchParams(p);
            n.set('after', pageInfo?.endCursor ?? '');
            return n;
          });
        }}
        onPrevPage={() => {
          setSearchParams((p) => {
            const n = new URLSearchParams(p);
            n.delete('after');
            return n;
          });
        }}
      />
      )}
    </div>
  );
}
