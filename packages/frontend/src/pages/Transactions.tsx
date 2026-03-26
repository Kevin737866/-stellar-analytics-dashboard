import { useQuery } from '@apollo/client';
import { TRANSACTIONS_QUERY } from '@/graphql/queries';
import { DataTable } from '@/components/DataTable';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Transactions() {
  const { data, loading, fetchMore } = useQuery(TRANSACTIONS_QUERY, {
    variables: { first: 15 },
  });

  const transactions = data?.transactions?.edges.map((e: any) => e.node) || [];
  const pageInfo = data?.transactions?.pageInfo;

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
        <Link to={`/transactions/${tx.hash}`} className="text-primary font-mono hover:underline">
          {tx.hash.slice(0, 8)}...{tx.hash.slice(-8)}
        </Link>
      ),
    },
    { header: 'Ledger', accessor: 'ledger' as const },
    {
      header: 'Source Account',
      accessor: (tx: any) => (
        <span className="text-muted-foreground truncate block w-32">{tx.sourceAccount}</span>
      ),
    },
    {
      header: 'Created',
      accessor: (tx: any) => formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true }),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Real-time ledger entries on Stellar
          </p>
        </div>
        <div className="flex gap-3">{/* Add Filter buttons here later */}</div>
      </div>

      <DataTable
        columns={columns}
        data={transactions}
        loading={loading}
        hasNextPage={pageInfo?.hasNextPage}
        hasPrevPage={pageInfo?.hasPrevPage}
        onNextPage={() => {
          fetchMore({ variables: { after: pageInfo?.endCursor } });
        }}
      />
    </div>
  );
}
