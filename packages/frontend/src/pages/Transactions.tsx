import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { TRANSACTIONS_QUERY } from '@/graphql/queries';
import { DataTable } from '@/components/DataTable';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, Search, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Transactions() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [searchHash, setSearchHash] = useState('');

  const { data, loading, fetchMore, refetch } = useQuery(TRANSACTIONS_QUERY, {
    variables: { first: 15 },
    pollInterval: 5000,
    notifyOnNetworkStatusChange: true,
  });

  const transactions = data?.transactions?.edges.map((e: any) => e.node) || [];
  const pageInfo = data?.transactions?.pageInfo;

  // Real-time filtering logic
  const filteredData = transactions.filter((tx: any) => {
    const matchesStatus =
      statusFilter === 'all' ? true : statusFilter === 'success' ? tx.successful : !tx.successful;
    const matchesHash = tx.hash.toLowerCase().includes(searchHash.toLowerCase());
    return matchesStatus && matchesHash;
  });

  const columns = [
    {
      header: 'Status',
      accessor: (tx: any) =>
        tx.successful ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        ),
    },
    {
      header: 'Hash',
      accessor: (tx: any) => (
        <Link
          to={`/transactions/${tx.hash}`}
          className="text-primary font-mono hover:underline font-bold"
        >
          {tx.hash.slice(0, 8)}...{tx.hash.slice(-8)}
        </Link>
      ),
    },
    { header: 'Ledger', accessor: (tx: any) => <span className="font-mono">#{tx.ledger}</span> },
    {
      header: 'Source Account',
      accessor: (tx: any) => (
        <span className="text-muted-foreground font-mono text-xs">
          {tx.sourceAccount.slice(0, 12)}...
        </span>
      ),
    },
    {
      header: 'Created',
      accessor: (tx: any) => formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true }),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <p className="text-muted-foreground text-sm font-medium">Live network activity</p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          Sync Now
        </button>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="flex flex-col lg:flex-row gap-4 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={18}
          />
          <input
            type="text"
            placeholder="Search hash..."
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            value={searchHash}
            onChange={(e) => setSearchHash(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border">
          {(['all', 'success', 'failed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold capitalize transition-all ${
                statusFilter === status
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        loading={loading}
        hasNextPage={pageInfo?.hasNextPage}
        onNextPage={() => fetchMore({ variables: { after: pageInfo?.endCursor } })}
      />
    </div>
  );
}
