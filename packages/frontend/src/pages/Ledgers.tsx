import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { LEDGERS_QUERY } from '@/graphql/queries';
import { DataTable } from '@/components/DataTable';
import { FilterBar, FilterRow, DateRangeInput, RangeInput } from '@/components/FilterBar';
import { formatDistanceToNow } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { ChartTooltip } from '@/components/ChartTooltip';
import { Database, Activity, Cpu } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';
import { useFilterSort } from '@/hooks/useFilterSort';
import type { FilterPreset } from '@/components/FilterBar';
import { ledgerFiltersSchema } from '@/lib/validation';
import { ApiErrorMessage } from '@/components/ApiErrorMessage';

// ── filter defaults ───────────────────────────────────────────────────────────

const DEFAULTS = {
  startTime: '',
  endTime: '',
  minOps: '',
  maxOps: '',
};

type LedgerFilters = typeof DEFAULTS;

function buildTimeRange(filters: LedgerFilters) {
  if (!filters.startTime && !filters.endTime) return undefined;
  return {
    startTime: filters.startTime || undefined,
    endTime: filters.endTime || undefined,
  };
}

function clientSort(ledgers: any[], field: string, dir: 'asc' | 'desc') {
  return [...ledgers].sort((a, b) => {
    let av: number = 0;
    let bv: number = 0;
    switch (field) {
      case 'sequence':
        av = a.sequence; bv = b.sequence; break;
      case 'operationCount':
        av = a.operationCount; bv = b.operationCount; break;
      case 'successfulTransactionCount':
        av = a.successfulTransactionCount; bv = b.successfulTransactionCount; break;
      case 'closedAt':
        av = new Date(a.closedAt).getTime(); bv = new Date(b.closedAt).getTime(); break;
      default:
        return 0;
    }
    return dir === 'asc' ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
  });
}

// ── component ─────────────────────────────────────────────────────────────────

export function Ledgers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterErrors, setFilterErrors] = useState<Record<string, string>>({});

  const { filters, sort, setFilter, setSort, resetFilters, activeCount } =
    useFilterSort<LedgerFilters>({
      defaults: DEFAULTS,
      sortDefaults: { field: 'sequence', dir: 'desc' },
    });

  const after = searchParams.get('after') ?? undefined;

  const { data, loading, error, fetchMore, refetch } = useQuery(LEDGERS_QUERY, {
    variables: {
      first: 20,
      after,
      timeRange: buildTimeRange(filters),
    },
    pollInterval: 5000,
  });

  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      prevFiltersRef.current = filters;
      refetch({ first: 20, after: undefined, timeRange: buildTimeRange(filters) });
    }
  }, [filters, refetch]);

  const rawLedgers = data?.ledgers?.edges.map((e: any) => e.node) || [];
  const pageInfo = data?.ledgers?.pageInfo;
  const totalCount = data?.ledgers?.totalCount;

  // Client-side op count filter
  const opFiltered = rawLedgers.filter((l: any) => {
    if (filters.minOps && l.operationCount < parseInt(filters.minOps)) return false;
    if (filters.maxOps && l.operationCount > parseInt(filters.maxOps)) return false;
    return true;
  });

  const sorted = clientSort(opFiltered, sort.field, sort.dir);

  // Chart data (always use raw, reversed for chronological order)
  const chartData = [...rawLedgers].reverse().map((l: any) => ({
    sequence: l.sequence,
    txCount: l.successfulTransactionCount,
    ops: l.operationCount,
  }));

  function LedgerTxTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as { sequence: number; txCount: number; ops: number } | undefined;
    if (!d) return null;
    return (
      <ChartTooltip
        header={<span className="font-mono">#{d.sequence}</span>}
        rows={[
          { label: 'Transactions', value: d.txCount.toLocaleString(), color: 'hsl(var(--primary))', dot: true },
          { label: 'Operations', value: d.ops.toLocaleString(), dot: true },
        ]}
      />
    );
  }

  // ── presets ────────────────────────────────────────────────────────────────

  const validateFilters = (updated: LedgerFilters) => {
    const result = ledgerFiltersSchema.safeParse(updated);
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

  const presets: FilterPreset[] = [
    {
      label: 'Last hour',
      apply: () => {
        resetFilters();
        setFilter('startTime', new Date(Date.now() - 60 * 60 * 1000).toISOString().slice(0, 16));
      },
    },
    {
      label: 'Last 24h',
      apply: () => {
        resetFilters();
        setFilter('startTime', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
      },
    },
    {
      label: 'Last 7 days',
      apply: () => {
        resetFilters();
        setFilter('startTime', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
      },
    },
    {
      label: 'High activity (>50 ops)',
      apply: () => { resetFilters(); setFilter('minOps', '50'); },
    },
  ];

  // ── columns ────────────────────────────────────────────────────────────────

  const columns = [
    {
      header: 'Sequence',
      sortField: 'sequence',
      accessor: (l: any) => (
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary/60" />
          <span className="font-mono font-bold text-primary">#{l.sequence}</span>
        </div>
      ),
    },
    {
      header: 'Transactions',
      sortField: 'successfulTransactionCount',
      accessor: (l: any) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-500 font-semibold">{l.successfulTransactionCount}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-500 font-semibold">{l.failedTransactionCount}</span>
            <span className="text-xs text-muted-foreground">success/fail</span>
          </div>
          <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{
                width: `${Math.min(
                  ((l.successfulTransactionCount + l.failedTransactionCount) / 50) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      header: 'Operations',
      sortField: 'operationCount',
      accessor: (l: any) => (
        <span className="font-medium tabular-nums">{l.operationCount}</span>
      ),
      className: 'text-center',
    },
    {
      header: 'Protocol',
      accessor: (l: any) => (
        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
          v{l.protocolVersion}
        </span>
      ),
      className: 'text-center',
    },
    {
      header: 'Closed',
      sortField: 'closedAt',
      accessor: (l: any) =>
        formatDistanceToNow(new Date(l.closedAt), { addSuffix: true }),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ledger Chain</h1>
          <p className="text-muted-foreground mt-1">Live immutable records from the network</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">
            Live Syncing
          </span>
        </div>
      </div>

      {/* Chart + metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="chart-container lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Transactions per Ledger
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="sequence" hide />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <Tooltip content={<LedgerTxTooltip />} />
                <Area
                  type="stepAfter"
                  dataKey="txCount"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary)/0.1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="space-y-6">
          <MetricCard
            title="Latest Height"
            value={rawLedgers[0]?.sequence?.toLocaleString() || '…'}
            icon={Database}
          />
          <MetricCard title="Protocol Version" value="21" icon={Cpu} changeLabel="Active" />
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar activeCount={activeCount} onReset={() => { resetFilters(); setFilterErrors({}); }} presets={presets}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
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

          <FilterRow label="Operations">
            <RangeInput
              minValue={filters.minOps}
              maxValue={filters.maxOps}
              onMinChange={(v) => {
                setFilter('minOps', v);
                validateFilters({ ...filters, minOps: v });
              }}
              onMaxChange={(v) => {
                setFilter('maxOps', v);
                validateFilters({ ...filters, maxOps: v });
              }}
              placeholder={{ min: '0', max: '∞' }}
              maxError={filterErrors.maxOps}
            />
          </FilterRow>
        </div>
      </FilterBar>

      {/* Table */}
      {error ? (
        <ApiErrorMessage error={error} onRetry={() => refetch()} />
      ) : (
      <DataTable
        caption="Ledgers"
        columns={columns}
        data={sorted}
        loading={loading}
        sort={sort}
        onSort={setSort}
        totalCount={totalCount}
        hasNextPage={pageInfo?.hasNextPage}
        hasPrevPage={pageInfo?.hasPreviousPage}
        onNextPage={() =>
          setSearchParams((p) => {
            const n = new URLSearchParams(p);
            n.set('after', pageInfo?.endCursor ?? '');
            return n;
          })
        }
        onPrevPage={() =>
          setSearchParams((p) => {
            const n = new URLSearchParams(p);
            n.delete('after');
            return n;
          })
        }
      />
      )}
    </div>
  );
}
