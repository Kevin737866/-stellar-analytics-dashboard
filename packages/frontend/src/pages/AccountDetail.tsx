import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUrlTab } from '@/hooks/useUrlTab';
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
import { ApiErrorMessage } from '@/components/ApiErrorMessage';

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
  const ACCOUNT_TABS = ['transactions', 'balances', 'signers'] as const;
  const [activeTab, setActiveTab] = useUrlTab<'transactions' | 'balances' | 'signers'>(
    'tab',
    'transactions',
    ACCOUNT_TABS,
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
        <ApiErrorMessage error={accountError} onRetry={() => navigate(0)} />
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
          aria-label="Back to Accounts list"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Accounts
        </button>
        <div className="flex items-center gap-2" role="group" aria-label="Export options">
          <button
            onClick={() => handleExport('csv')}
            className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
            aria-label="Export account data as CSV"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => handleExport('json')}
            className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
            aria-label="Export account data as JSON"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            onClick={handleShare}
            className="p-2 rounded-lg border bg-card hover:bg-accent transition-colors"
            aria-label="Share link to this account"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Account Header */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Wallet className="h-8 w-8" aria-hidden="true" />
              Account Profile
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono text-sm" aria-label={`Account ID: ${accountId}`}>
                {accountId}
              </span>
              <button
                onClick={handleCopy}
                className="p-1 hover:text-foreground transition-colors"
                aria-label={copied ? 'Account ID copied' : 'Copy account ID to clipboard'}
                aria-live="polite"
              >
                {copied ? (
                  <span className="text-green-500 text-xs">Copied!</span>
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <a
                href={getStellarExpertUrl(accountId || '')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:text-foreground transition-colors"
                aria-label="View this account on StellarExpert (opens in new tab)"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground" id="account-status-label">Status</div>
            <div
              className={`font-semibold ${metrics?.isActive ? 'text-green-500' : 'text-yellow-500'}`}
              aria-labelledby="account-status-label"
            >
              {metrics?.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-accent/50">
            <dt className="text-sm text-muted-foreground">Sequence</dt>
            <dd className="font-mono text-lg">{account?.sequenceNumber}</dd>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <dt className="text-sm text-muted-foreground">Subentries</dt>
            <dd className="font-mono text-lg">{account?.numSubentries}</dd>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <dt className="text-sm text-muted-foreground">Signers</dt>
            <dd className="font-mono text-lg">{account?.signers.length}</dd>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <dt className="text-sm text-muted-foreground">Trustlines</dt>
            <dd className="font-mono text-lg">{metrics?.trustlines}</dd>
          </div>
        </dl>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {accountMetrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div role="tablist" aria-label="Account details sections" className="flex gap-6">
          {(['transactions', 'balances', 'signers'] as const).map((tab) => (
            <button
              key={tab}
              role="tab"
              id={`tab-${tab}`}
              aria-selected={activeTab === tab}
              aria-controls={`tabpanel-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 font-medium transition-colors border-b-2 capitalize ${
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'transactions' ? 'Transactions' : tab === 'balances' ? 'Balances' : 'Signers'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'transactions' && (
        <div
          role="tabpanel"
          id="tabpanel-transactions"
          aria-labelledby="tab-transactions"
          className="rounded-lg border bg-card"
        >
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Transaction History</h2>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {transactionsData?.transactions.totalCount || 0} total transactions
            </span>
          </div>
          {txLoading ? (
            <div
              className="p-8 text-center"
              role="status"
              aria-label="Loading transactions"
              aria-busy="true"
            >
              <div className="loading-skeleton h-8 w-full" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No transactions found</div>
          ) : (
            <ul className="divide-y" role="list" aria-label="Transaction history">
              {transactions.map((tx) => (
                <li key={tx.id}>
                  <button
                    onClick={() => navigate(`/transactions/${tx.hash}`)}
                    className="w-full p-4 hover:bg-accent/50 cursor-pointer transition-colors text-left"
                    aria-label={`Transaction ${tx.hash}, ${tx.successful ? 'successful' : 'failed'}, ledger ${tx.ledger}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {tx.successful ? (
                          <TrendingUp className="h-5 w-5 text-green-500" aria-hidden="true" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-500" aria-hidden="true" />
                        )}
                        <div>
                          <div className="font-mono text-sm">{formatAccountId(tx.hash)}</div>
                          <div className="text-xs text-muted-foreground">
                            Ledger {tx.ledger} •{' '}
                            <time dateTime={tx.createdAt}>
                              {format(new Date(tx.createdAt), 'MMM dd, HH:mm')}
                            </time>
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
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'balances' && (
        <div
          role="tabpanel"
          id="tabpanel-balances"
          aria-labelledby="tab-balances"
          className="rounded-lg border bg-card"
        >
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Balances</h2>
          </div>
          <ul className="divide-y" role="list">
            <li className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-yellow-500" aria-hidden="true" />
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
            </li>
          </ul>
        </div>
      )}

      {activeTab === 'signers' && (
        <div
          role="tabpanel"
          id="tabpanel-signers"
          aria-labelledby="tab-signers"
          className="rounded-lg border bg-card"
        >
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Signers</h2>
          </div>
          <ul className="divide-y" role="list">
            {account?.signers.map((signer, index) => (
              <li key={index} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
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
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Account Details */}
      <section aria-labelledby="account-details-heading" className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 id="account-details-heading" className="text-lg font-semibold">Account Details</h2>
        </div>
        <dl className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">Created</dt>
            <dd className="font-medium">
              {account?.createdAt && (
                <time dateTime={account.createdAt}>
                  {format(new Date(account.createdAt), 'MMM dd, yyyy HH:mm')}
                </time>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Last Modified</dt>
            <dd className="font-medium">
              {account?.updatedAt && (
                <time dateTime={account.updatedAt}>
                  {format(new Date(account.updatedAt), 'MMM dd, yyyy HH:mm')}
                </time>
              )}
            </dd>
          </div>
          {account?.sponsor && (
            <>
              <div>
                <dt className="text-sm text-muted-foreground">Sponsor</dt>
                <dd className="font-mono text-sm">{account.sponsor}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Sponsoring</dt>
                <dd className="font-medium">{account.numSponsoring} accounts</dd>
              </div>
            </>
          )}
        </dl>
      </section>
    </div>
  );
}
