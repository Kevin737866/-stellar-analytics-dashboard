import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import {
  ArrowLeft,
  ArrowRightLeft,
  Copy,
  ExternalLink,
  Download,
  Share2,
  FileText,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Users,
} from 'lucide-react';

import { TRANSACTION_QUERY } from '@/graphql/queries';

interface Operation {
  id: string;
  type: string;
  sourceAccount: string;
  createdAt: string;
  details: Record<string, unknown>;
}

interface TransactionData {
  transaction: {
    id: string;
    hash: string;
    successful: boolean;
    ledger: number;
    createdAt: string;
    sourceAccount: string;
    sourceAccountSequence: string;
    feeAccount: string;
    feeCharged: number;
    maxFee: number;
    operationCount: number;
    envelopeXdr: string;
    resultXdr: string;
    memoType: string | null;
    memo: string | null;
    signatures: string[];
    operations: Operation[];
  };
}

function formatHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
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

function getStellarExpertUrl(hash: string): string {
  return `https://stellar.expert/explorer/public/tx/${hash}`;
}

const OPERATION_LABELS: Record<string, string> = {
  create_account: 'Create Account',
  payment: 'Payment',
  path_payment_strict_receive: 'Path Payment (Strict Receive)',
  path_payment_strict_send: 'Path Payment (Strict Send)',
  manage_sell_offer: 'Manage Sell Offer',
  manage_buy_offer: 'Manage Buy Offer',
  create_passive_sell_offer: 'Create Passive Sell Offer',
  set_options: 'Set Options',
  change_trust: 'Change Trust',
  allow_trust: 'Allow Trust',
  account_merge: 'Account Merge',
  inflation: 'Inflation',
  manage_data: 'Manage Data',
  bump_sequence: 'Bump Sequence',
  claim_claimable_balance: 'Claim Claimable Balance',
  begin_sponsoring_future_reserves: 'Begin Sponsoring Future Reserves',
  end_sponsoring_future_reserves: 'End Sponsoring Future Reserves',
  revoke_sponsorship: 'Revoke Sponsorship',
  clawback: 'Clawback',
  clawback_claimable_balance: 'Clawback Claimable Balance',
  set_trust_line_flags: 'Set Trust Line Flags',
  liquidity_pool_deposit: 'Liquidity Pool Deposit',
  liquidity_pool_withdraw: 'Liquidity Pool Withdraw',
  invoke_host_function: 'Invoke Host Function',
};

function decodeXDRPreview(xdr: string): string {
  if (!xdr) return '';
  return xdr.slice(0, 100) + (xdr.length > 100 ? '...' : '');
}

export function TransactionDetail() {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'operations' | 'xdr'>('overview');
  const [showFullXdr, setShowFullXdr] = useState<Record<string, boolean>>({});

  const { data, loading, error } = useQuery<TransactionData>(TRANSACTION_QUERY, {
    variables: { hash },
    skip: !hash,
  });

  const handleCopy = (text: string, field: string) => {
    copyToClipboard(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Stellar Transaction: ${formatHash(hash || '')}`,
        url,
      });
    } else {
      copyToClipboard(url);
      setCopied('url');
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const tx = data?.transaction;
    if (!tx) return;

    const exportData = {
      hash: tx.hash,
      successful: tx.successful,
      ledger: tx.ledger,
      createdAt: tx.createdAt,
      sourceAccount: tx.sourceAccount,
      feeCharged: tx.feeCharged,
      maxFee: tx.maxFee,
      operationCount: tx.operationCount,
      memoType: tx.memoType,
      memo: tx.memo,
      signatures: tx.signatures,
      operations: tx.operations,
    };

    if (format === 'csv') {
      exportToCSV([exportData], `tx-${hash}`);
    } else {
      exportToJSON(exportData, `tx-${hash}`);
    }
  };

  if (loading) {
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

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/transactions')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
        </button>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-destructive mb-2">Transaction not found</h2>
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  const tx = data?.transaction;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/transactions')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Transactions
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

      {/* Transaction Header */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8" />
              Transaction Details
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-mono text-sm">{tx?.hash}</span>
              <button
                onClick={() => handleCopy(tx?.hash || '', 'hash')}
                className="p-1 hover:text-foreground transition-colors"
                title="Copy transaction hash"
              >
                {copied === 'hash' ? (
                  <span className="text-green-500 text-xs">Copied!</span>
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <a
                href={getStellarExpertUrl(hash || '')}
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
            <div className="flex items-center gap-2 font-semibold">
              {tx?.successful ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                  <span className="text-green-500">Success</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                  <span className="text-red-500">Failed</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="text-sm text-muted-foreground">Ledger</div>
            <div className="font-mono text-lg">{tx?.ledger}</div>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="text-sm text-muted-foreground">Operations</div>
            <div className="font-mono text-lg">{tx?.operationCount}</div>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="text-sm text-muted-foreground">Fee Charged</div>
            <div className="font-mono text-lg">
              {tx ? (tx.feeCharged / 1000000).toFixed(5) : 0} XLM
            </div>
          </div>
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="text-sm text-muted-foreground">Max Fee</div>
            <div className="font-mono text-lg">{tx ? (tx.maxFee / 1000000).toFixed(5) : 0} XLM</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('operations')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'operations'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Operations ({tx?.operations.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('xdr')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'xdr'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            XDR
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Source Account */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Source Account</h2>
            </div>
            <div className="p-4">
              <div
                className="flex items-center justify-between cursor-pointer hover:bg-accent/50 p-2 rounded"
                onClick={() => navigate(`/accounts/${tx?.sourceAccount}`)}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-mono">{tx?.sourceAccount}</span>
                </div>
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-sm text-muted-foreground">Sequence</div>
                  <div className="font-mono">{tx?.sourceAccountSequence}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Fee Account</div>
                  <div className="font-mono text-sm">{tx?.feeAccount || 'Same as source'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Memo */}
          {tx?.memo && (
            <div className="rounded-lg border bg-card">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Memo</h2>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Type: {tx.memoType || 'none'}
                  </span>
                </div>
                <div className="mt-2 p-3 bg-accent/50 rounded-lg font-mono">{tx.memo}</div>
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Signatures ({tx?.signatures.length || 0})
              </h2>
            </div>
            <div className="divide-y">
              {tx?.signatures.map((sig, index) => (
                <div key={index} className="p-4 flex items-center justify-between">
                  <div className="font-mono text-sm">{formatHash(sig)}</div>
                  <button
                    onClick={() => handleCopy(sig, `sig-${index}`)}
                    className="p-1 hover:text-foreground transition-colors"
                  >
                    {copied === `sig-${index}` ? (
                      <span className="text-green-500 text-xs">Copied!</span>
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Timestamps */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timestamps
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Created At</div>
                <div className="font-medium">
                  {tx?.createdAt && format(new Date(tx.createdAt), 'MMM dd, yyyy HH:mm:ss')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'operations' && (
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Operations</h2>
          </div>
          <div className="divide-y">
            {tx?.operations.map((op, index) => (
              <div key={op.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{OPERATION_LABELS[op.type] || op.type}</div>
                      <div className="text-sm text-muted-foreground">
                        Source: {formatHash(op.sourceAccount)}
                      </div>
                    </div>
                  </div>
                </div>
                {op.details && Object.keys(op.details).length > 0 && (
                  <div className="mt-3 ml-11 p-3 bg-accent/50 rounded-lg">
                    <pre className="text-xs font-mono overflow-x-auto">
                      {JSON.stringify(op.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'xdr' && (
        <div className="space-y-4">
          {/* Envelope XDR */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Transaction Envelope (XDR)</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFullXdr((prev) => ({ ...prev, envelope: !prev.envelope }))}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {showFullXdr.envelope ? 'Show less' : 'Show more'}
                </button>
                <button
                  onClick={() => handleCopy(tx?.envelopeXdr || '', 'envelope')}
                  className="p-1 hover:text-foreground transition-colors"
                >
                  {copied === 'envelope' ? (
                    <span className="text-green-500 text-xs">Copied!</span>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="p-4">
              <pre className="text-xs font-mono break-all bg-accent/50 p-3 rounded-lg overflow-x-auto max-h-64">
                {showFullXdr.envelope ? tx?.envelopeXdr : decodeXDRPreview(tx?.envelopeXdr || '')}
              </pre>
            </div>
          </div>

          {/* Result XDR */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Transaction Result (XDR)</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFullXdr((prev) => ({ ...prev, result: !prev.result }))}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {showFullXdr.result ? 'Show less' : 'Show more'}
                </button>
                <button
                  onClick={() => handleCopy(tx?.resultXdr || '', 'result')}
                  className="p-1 hover:text-foreground transition-colors"
                >
                  {copied === 'result' ? (
                    <span className="text-green-500 text-xs">Copied!</span>
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="p-4">
              <pre className="text-xs font-mono break-all bg-accent/50 p-3 rounded-lg overflow-x-auto max-h-64">
                {showFullXdr.result ? tx?.resultXdr : decodeXDRPreview(tx?.resultXdr || '')}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
