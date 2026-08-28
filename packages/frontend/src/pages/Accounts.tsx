import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { Search, Wallet, Share2, Clock, Download, FileText } from 'lucide-react';
import { ACCOUNTS_QUERY } from '@/graphql/queries';
import { DataTable } from '@/components/DataTable';
import { FilterBar, FilterRow, ToggleGroup, RangeInput } from '@/components/FilterBar';
import { useFilterSort } from '@/hooks/useFilterSort';
import type { FilterPreset } from '@/components/FilterBar';
import { ValidationMessage } from '@/components/ValidationMessage';
import { accountFiltersSchema } from '@/lib/validation';
import { clsx } from 'clsx';
import { ApiErrorMessage } from '@/components/ApiErrorMessage';

// ── types ─────────────────────────────────────────────────────────────────────

interface Account {
  accountId: string;
  balance: string;
  assetType: string;
  assetCode: string;
  assetIssuer: string;
  lastModifiedLedger: number;
  sequenceNumber: string;
  numSubentries: number;
  thresholds: Record<string, unknown>;
  flags: Record<string, unknown>;
  signers: Array<{ key: string; weight: number }>;
  createdAt: string;
  updatedAt: string;
}

// ── filter defaults ───────────────────────────────────────────────────────────

const DEFAULTS = {
  search: '',
  minBalance: '',
  maxBalance: '',
  isActive: '' as '' | 'true' | 'false',
};

type AccountFilters = typeof DEFAULTS;

// ── helpers ───────────────────────────────────────────────────────────────────

function buildGqlFilter(filters: AccountFilters) {
  const f: Record<string, unknown> = {};
  if (filters.search) f.accountId = filters.search;
  if (filters.minBalance) f.minBalance = filters.minBalance;
  if (filters.maxBalance) f.maxBalance = filters.maxBalance;
  if (filters.isActive === 'true') f.isActive = true;
  if (filters.isActive === 'false') f.isActive = false;
  return Object.keys(f).length ? f : undefined;
}

function clientSort(accounts: Account[], field: string, dir: 'asc' | 'desc') {
  return [...accounts].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;
    switch (field) {
      case 'balance':
        av = parseFloat(a.balance);
        bv = parseFloat(b.balance);
        break;
      case 'numSubentries':
        av = a.numSubentries;
        bv = b.numSubentries;
        break;
      case 'createdAt':
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
        break;
      case 'accountId':
        av = a.accountId;
        bv = b.accountId;
        break;
      default:
        return 0;
    }
    return dir === 'asc' ? (av < bv ? -1 : 1) : av > bv ? -1 : 1;
  });
}

function exportToCSV(data: Account[], filename: string) {
  if (!data.length) return;
  const keys: (keyof Account)[] = ['accountId', 'balance', 'sequenceNumber', 'numSubentries', 'createdAt'];
  const csv = [
    keys.join(','),
    ...data.map((row) => keys.map((k) => `"${String(row[k] ?? '')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

function exportToJSON(data: Account[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.json`;
  link.click();
}

// ── component ─────────────────────────────────────────────────────────────────

export function Accounts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState<string | null>(null);
  const [filterErrors, setFilterErrors] = useState<Record<string, string>>({});

  const { filters, sort, setFilter, setSort, resetFilters, activeCount } =
    useFilterSort<AccountFilters>({
      defaults: DEFAULTS,
      sortDefaults: { field: 'createdAt', dir: 'desc' },
    });

  const after = searchParams.get('after') ?? undefined;

  const { data, loading, error, refetch } = useQuery(ACCOUNTS_QUERY, {
    variables: {
      first: 20,
      after,
      filter: buildGqlFilter(filters),
    },
    notifyOnNetworkStatusChange: true,
  });

  // Refetch when filters change
  const prevFiltersRef = useRef(filters);
  useEffect(() => {
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      prevFiltersRef.current = filters;
      refetch({ first: 20, after: undefined, filter: buildGqlFilter(filters) });
    }
  }, [filters, refetch]);

  const rawAccounts: Account[] = data?.accounts?.edges.map((e: any) => e.node) || [];
  const pageInfo = data?.accounts?.pageInfo;
  const totalCount = data?.accounts?.totalCount || 0;

  const sorted = clientSort(rawAccounts, sort.field, sort.dir);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  /** Validate filters and update error state; returns true if valid */
  const validateFilters = (updated: AccountFilters) => {
    const result = accountFiltersSchema.safeParse(updated);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        const key = e.path[0] as string;
        errs[key] = e.message;
      });
      setFilterErrors(errs);
      return false;
    }
    setFilterErrors({});
    return true;
  };

  // ── presets ────────────────────────────────────────────────────────────────

  const presets: FilterPreset[] = [
    {
      label: 'High balance',
      description: 'Accounts with more than 10,000 XLM',
      apply: () => { resetFilters(); setFilter('minBalance', '10000'); },
    },
    {
      label: 'Low balance',
      description: 'Accounts with less than 10 XLM',
      apply: () => { resetFilters(); setFilter('maxBalance', '10'); },
    },
    {
      label: 'Active accounts',
      description: 'Recently active accounts',
      apply: () => { resetFilters(); setFilter('isActive', 'true'); },
    },
    {
      label: 'Multi-sig',
      description: 'Accounts with multiple signers (numSubentries > 1)',
      apply: () => { resetFilters(); setFilter('minBalance', '1'); },
    },
  ];

  // ── columns ────────────────────────────────────────────────────────────────

  const columns = [
    {
      header: 'Account ID',
      sortField: 'accountId',
      accessor: (account: Account) => (
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-sm">
            {account.accountId.slice(0, 6)}…{account.accountId.slice(-4)}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy(account.accountId); }}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy account ID"
          >
            {copied === account.accountId ? (
              <span className="text-green-500 text-xs font-medium">Copied!</span>
            ) : (
              <Share2 className="h-3 w-3" />
            )}
          </button>
        </div>
      ),
    },
    {
      header: 'Balance',
      sortField: 'balance',
      accessor: (account: Account) => (
        <span className="font-medium tabular-nums">
          {parseFloat(account.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
        </span>
      ),
    },
    {
      header: 'Sequence',
      accessor: (account: Account) => (
        <span className="font-mono text-sm text-muted-foreground">{account.sequenceNumber}</span>
      ),
    },
    {
      header: 'Subentries',
      sortField: 'numSubentries',
      accessor: (account: Account) => (
        <span className="tabular-nums">{account.numSubentries}</span>
      ),
      className: 'text-center',
    },
    {
      header: 'Created',
      sortField: 'createdAt',
      accessor: (account: Account) => (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">
            {account.createdAt ? format(new Date(account.createdAt), 'MMM dd, yyyy') : '—'}
          </span>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
          <p className="text-muted-foreground mt-1">Browse and analyze Stellar accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(sorted, 'accounts')}
            className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => exportToJSON(sorted, 'accounts')}
            className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
            title="Export to JSON"
          >
            <FileText className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by account ID…"
          value={filters.search}
          onChange={(e) => {
            setFilter('search', e.target.value);
            if (filterErrors.search) setFilterErrors((prev) => ({ ...prev, search: '' }));
          }}
          onBlur={() => validateFilters(filters)}
          aria-label="Search accounts by ID"
          aria-invalid={!!filterErrors.search}
          aria-describedby={filterErrors.search ? 'account-search-error' : undefined}
          className={clsx(
            'w-full pl-9 pr-4 py-2.5 rounded-xl border bg-card focus:outline-none focus:ring-2 text-sm',
            filterErrors.search
              ? 'border-destructive focus:ring-destructive/30'
              : 'border-border focus:ring-primary/30'
          )}
        />
        {filterErrors.search && (
          <ValidationMessage id="account-search-error" error={filterErrors.search} />
        )}
      </div>

      {/* Filter bar */}
      <FilterBar activeCount={activeCount} onReset={() => { resetFilters(); setFilterErrors({}); }} presets={presets}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <FilterRow label="Balance (XLM)">
            <RangeInput
              minValue={filters.minBalance}
              maxValue={filters.maxBalance}
              onMinChange={(v) => {
                setFilter('minBalance', v);
                validateFilters({ ...filters, minBalance: v });
              }}
              onMaxChange={(v) => {
                setFilter('maxBalance', v);
                validateFilters({ ...filters, maxBalance: v });
              }}
              placeholder={{ min: '0', max: '∞' }}
              unit="XLM"
              maxError={filterErrors.maxBalance}
            />
          </FilterRow>

          <FilterRow label="Activity">
            <ToggleGroup
              options={[
                { label: 'Any', value: '' },
                { label: 'Active', value: 'true' },
                { label: 'Inactive', value: 'false' },
              ]}
              value={filters.isActive}
              onChange={(v) => setFilter('isActive', v as string)}
            />
          </FilterRow>
        </div>
      </FilterBar>

      {/* Error */}
      {error && (
        <ApiErrorMessage error={error} onRetry={() => refetch()} />
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={sorted}
        loading={loading}
        sort={sort}
        onSort={setSort}
        totalCount={totalCount}
        hasNextPage={pageInfo?.hasNextPage}
        hasPrevPage={pageInfo?.hasPreviousPage}
        onRowClick={(account) => navigate(`/accounts/${account.accountId}`)}
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
    </div>
  );
}
