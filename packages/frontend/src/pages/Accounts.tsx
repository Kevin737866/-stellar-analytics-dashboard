import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import {
  Search,
  Wallet,
  ArrowUpDown,
  Download,
  FileText,
  Share2,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';

import { ACCOUNTS_QUERY } from '@/graphql/queries';

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

interface AccountsData {
  accounts: {
    edges: Array<{
      cursor: string;
      node: Account;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    totalCount: number;
  };
}

function formatAccountId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text);
}

function exportToCSV(data: unknown[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0] as Record<string, unknown>);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = (row as Record<string, unknown>)[header];
          const stringValue = String(value ?? '');
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

function exportToJSON(data: unknown, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.json`;
  link.click();
}

export function Accounts() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'accountId' | 'balance' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [cursor, setCursor] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data, loading, error, refetch } = useQuery<AccountsData>(ACCOUNTS_QUERY, {
    variables: {
      first: 20,
      after: cursor,
      filter: searchTerm ? { accountId: searchTerm } : undefined,
    },
    notifyOnNetworkStatusChange: true,
  });

  const handleSort = (field: 'accountId' | 'balance' | 'createdAt') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleCopy = (text: string) => {
    copyToClipboard(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleExport = (format: 'csv' | 'json') => {
    const accounts = data?.accounts.edges.map((e) => e.node) || [];
    if (format === 'csv') {
      exportToCSV(accounts, 'accounts');
    } else {
      exportToJSON(accounts, 'accounts');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCursor(null);
    refetch({ after: undefined, filter: searchTerm ? { accountId: searchTerm } : undefined });
  };

  const accounts = data?.accounts.edges.map((e) => e.node) || [];
  const pageInfo = data?.accounts.pageInfo;
  const totalCount = data?.accounts.totalCount || 0;

  const sortedAccounts = [...accounts].sort((a, b) => {
    let aVal: string | number = '';
    let bVal: string | number = '';

    switch (sortField) {
      case 'accountId':
        aVal = a.accountId;
        bVal = b.accountId;
        break;
      case 'balance':
        aVal = parseFloat(a.balance);
        bVal = parseFloat(b.balance);
        break;
      case 'createdAt':
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
        break;
    }

    if (sortDir === 'asc') {
      return aVal < bVal ? -1 : 1;
    }
    return aVal > bVal ? -1 : 1;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
          <p className="text-muted-foreground mt-2">Browse and analyze Stellar accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
            title="Export to CSV"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleExport('json')}
            className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
            title="Export to JSON"
          >
            <FileText className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by account ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {accounts.length} of {totalCount.toLocaleString()} accounts
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-accent/50">
              <tr>
                <th
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-accent"
                  onClick={() => handleSort('accountId')}
                >
                  <div className="flex items-center gap-2">
                    Account ID
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-accent"
                  onClick={() => handleSort('balance')}
                >
                  <div className="flex items-center gap-2">
                    Balance
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">Sequence</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Subentries</th>
                <th
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-accent"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-2">
                    Created
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                [...Array(10)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-4">
                      <div className="loading-skeleton h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-destructive">
                    Error loading accounts: {error.message}
                  </td>
                </tr>
              ) : sortedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No accounts found
                  </td>
                </tr>
              ) : (
                sortedAccounts.map((account) => (
                  <tr
                    key={account.accountId}
                    className="hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/accounts/${account.accountId}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {formatAccountId(account.accountId)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(account.accountId);
                          }}
                          className="p-1 hover:text-foreground transition-colors"
                        >
                          {copied === account.accountId ? (
                            <span className="text-green-500 text-xs">Copied!</span>
                          ) : (
                            <Share2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {parseFloat(account.balance).toLocaleString()} XLM
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{account.sequenceNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{account.numSubentries}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {account.createdAt && format(new Date(account.createdAt), 'MMM dd, yyyy')}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page{' '}
          {cursor
            ? Math.ceil(
                accounts.findIndex((a) => a.accountId === data?.accounts.edges[0]?.node.accountId) /
                  20
              ) + 1
            : 1}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(pageInfo?.startCursor || null)}
            disabled={!pageInfo?.hasPreviousPage}
            className="p-2 rounded-lg border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(pageInfo?.endCursor || null)}
            disabled={!pageInfo?.hasNextPage}
            className="p-2 rounded-lg border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
