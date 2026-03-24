import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Wallet,
  Activity,
  Copy,
  ExternalLink,
  Download,
  Share2,
  TrendingUp,
  TrendingDown,
  Users,
  Coins,
  FileText,
  Link,
} from 'lucide-react';

import { ACCOUNT_QUERY, ACCOUNT_METRICS_QUERY, TRANSACTIONS_QUERY } from '@/graphql/queries';
import { MetricCard } from '@/components/MetricCard';

interface AccountData {
  account: {
    accountId: string;
    balance: string;
    assetType: string;
    assetCode: string;
    assetIssuer: string;
    sequenceNumber: string;
    numSubentries: number;
    thresholds: Record<string, unknown>;
    flags: Record<string, unknown>;
    signers: Array<{ key: string; weight: number }>;
    data: Record<string, string>;
    sponsor: string | null;
    numSponsored: number;
    numSponsoring: number;
    createdAt: string;
    updatedAt: string;
  };
}

interface AccountMetricsData {
  accountMetrics: {
    accountId: string;
    balanceNative: string;
    totalBalanceUsd: string;
    transactionCount24h: number;
    transactionCount7d: number;
    transactionCount30d: number;
    firstTransaction: string | null;
    lastTransaction: string;
    isActive: boolean;
    trustlines: number;
    signers: number;
  };
}

interface TransactionsData {
  transactions: {
    edges: Array<{
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
        memoType: string | null;
        memo: string | null;
      };
    }>;
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

function getStellarExpertUrl(accountId: string): string {
  return `https://stellar.expert/explorer/public/account/${accountId}`;
}

export function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'balances' | 'signers'>(
    'transactions'
  );

  const {
    data: accountData,
    loading: accountLoading,
    error: accountError,
  } = useQuery<AccountData>(ACCOUNT_QUERY, {
    variables: { accountId },
    skip: !accountId,
  });

  const { data: metricsData } = useQuery<AccountMetricsData>(ACCOUNT_METRICS_QUERY, {
    variables: { accountId, timeRange: { startTime: undefined, endTime: undefined } },
    skip: !accountId,
  });

  const { data: transactionsData, loading: txLoading } = useQuery<TransactionsData>(
    TRANSACTIONS_QUERY,
    {
      variables: { first: 20, filter: { successful: undefined } },
      skip: !accountId,
    }
  );

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    if (accountId) {
      copyToClipboard(accountId);
      setCopied(true);
    }
  };

  const handleShare = () => {
    if (accountId) {
      const url = window.location.href;
      if (navigator.share) {
        navigator.share({
          title: `Stellar Account: ${formatAccountId(accountId)}`,
          url,
        });
      } else {
        copyToClipboard(url);
        setCopied(true);
      }
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const account = accountData?.account;
    if (!account) return;

    const data = {
      accountId: account.accountId,
      balance: account.balance,
      sequenceNumber: account.sequenceNumber,
      numSubentries: account.numSubentries,
      flags: account.flags,
      signers: account.signers,
      sponsor: account.sponsor,
      createdAt: account.createdAt,
      metrics: metricsData?.accountMetrics,
    };

    if (format === 'csv') {
      exportToCSV([data], `account-${accountId}`);
    } else {
      exportToJSON(data, `account-${accountId}`);
    }
  };

  if (accountLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 loading-skeleton" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 loading-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (accountError) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/accounts')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Accounts
        </button>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-destructive mb-2">Account not found</h2>
          <p className="text-muted-foreground">{accountError.message}</p>
        </div>
      </div>
    );
  }

  const account = accountData?.account;
  const metrics = metricsData?.accountMetrics;
  const transactions = transactionsData?.transactions.edges.map((e) => e.node) || [];

  const accountMetrics = [
    {
      title: 'Balance',
      value: account ? `${parseFloat(account.balance).toLocaleString()} XLM` : '0 XLM',
      icon: Wallet,
      change: 0,
      changeLabel: 'Native',
      format: 'currency' as const,
    },
    {
      title: 'Transactions (24h)',
      value: metrics?.transactionCount24h.toLocaleString() || '0',
      icon: Activity,
      change: metrics?.transactionCount24h || 0,
      changeLabel: '24 hours',
      format: 'number' as const,
    },
    {
      title: 'Trustlines',
      value: metrics?.trustlines.toLocaleString() || '0',
      icon: Link,
      change: metrics?.trustlines || 0,
      changeLabel: 'assets',
      format: 'number' as const,
    },
    {
      title: 'Subentries',
      value: account?.numSubentries.toLocaleString() || '0',
      icon: FileText,
      change: account?.numSubentries || 0,
      changeLabel: 'entries',
      format: 'number' as const,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/accounts')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Accounts
        </button>
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
          <button
            onClick={handleShare}
            className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
            title="Share link"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Account Header */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Wallet className="h-8 w-8" />
              Account Profile
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono text-sm">{accountId}</span>
              <button
                onClick={handleCopy}
                className="p-1 hover:text-foreground transition-colors"
                title="Copy account ID"
              >
                {copied ? (
                  <span className="text-green-500 text-xs">Copied!</span>
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <a
                href={getStellarExpertUrl(accountId || '')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:text-foreground transition-colors"
                title="View on StellarExpert"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Status</div>
            <div
              className={`font-semibold ${metrics?.isActive ? 'text-green-500' : 'text-yellow-500'}`}
            >
              {metrics?.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="text-sm text-muted-foreground">Sequence</div>
            <div className="font-mono text-lg">{account?.sequenceNumber}</div>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="text-sm text-muted-foreground">Subentries</div>
            <div className="font-mono text-lg">{account?.numSubentries}</div>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="text-sm text-muted-foreground">Signers</div>
            <div className="font-mono text-lg">{account?.signers.length}</div>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="text-sm text-muted-foreground">Trustlines</div>
            <div className="font-mono text-lg">{metrics?.trustlines}</div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {accountMetrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'transactions'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('balances')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'balances'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Balances
          </button>
          <button
            onClick={() => setActiveTab('signers')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'signers'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Signers
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'transactions' && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Transaction History</h2>
            <span className="text-sm text-muted-foreground">
              {transactionsData?.transactions.totalCount || 0} total transactions
            </span>
          </div>
          {txLoading ? (
            <div className="p-8 text-center">
              <div className="loading-skeleton h-8 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No transactions found</div>
          ) : (
            <div className="divide-y">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => navigate(`/transactions/${tx.hash}`)}
                  className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {tx.successful ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-mono text-sm">{formatAccountId(tx.hash)}</div>
                        <div className="text-xs text-muted-foreground">
                          Ledger {tx.ledger} • {format(new Date(tx.createdAt), 'MMM dd, HH:mm')}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {(tx.feeCharged / 1000000).toFixed(5)} XLM
                      </div>
                      <div className="text-xs text-muted-foreground">{tx.operationCount} ops</div>
                    </div>
                  </div>
                  {tx.memo && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium">Memo:</span> {tx.memo}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'balances' && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Balances</h2>
          </div>
          <div className="divide-y">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="font-medium">XLM (Native)</div>
                  <div className="text-xs text-muted-foreground">Stellar's native asset</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">
                  {parseFloat(account?.balance || '0').toLocaleString()} XLM
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'signers' && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Signers</h2>
          </div>
          <div className="divide-y">
            {account?.signers.map((signer, index) => (
              <div key={index} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-mono text-sm">{signer.key}</div>
                    <div className="text-xs text-muted-foreground">
                      {signer.key.length === 64 ? 'Public Key' : 'Pre-authorized Transaction Hash'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">Weight: {signer.weight}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Details */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Account Details</h2>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="font-medium">
              {account?.createdAt && format(new Date(account.createdAt), 'MMM dd, yyyy HH:mm')}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Last Modified</div>
            <div className="font-medium">
              {account?.updatedAt && format(new Date(account.updatedAt), 'MMM dd, yyyy HH:mm')}
            </div>
          </div>
          {account?.sponsor && (
            <>
              <div>
                <div className="text-sm text-muted-foreground">Sponsor</div>
                <div className="font-mono text-sm">{account.sponsor}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Sponsoring</div>
                <div className="font-medium">{account.numSponsoring} accounts</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
