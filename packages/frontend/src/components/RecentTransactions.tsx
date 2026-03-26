import { useQuery } from '@apollo/client';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { TRANSACTIONS_QUERY } from '@/graphql/queries';

export function RecentTransactions() {
  const { data, loading, error } = useQuery(TRANSACTIONS_QUERY, {
    variables: { first: 10 },
    pollInterval: 5000, // Optional: fallback polling if subscriptions aren't active
  });

  if (loading) return <div className="h-80 loading-skeleton rounded-lg" />;
  if (error)
    return (
      <div className="p-4 text-destructive bg-destructive/10 rounded-lg">
        Failed to load transactions
      </div>
    );

  const transactions = data?.transactions?.edges || [];

  return (
    <div className="chart-container overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Recent Transactions</h3>
        <button className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 font-medium">
          View all <ExternalLink size={14} />
        </button>
      </div>

      <div className="overflow-x-auto -mx-6">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border bg-muted/30">
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold">Hash</th>
              <th className="px-6 py-3 font-semibold">Ledger</th>
              <th className="px-6 py-3 font-semibold">Source</th>
              <th className="px-6 py-3 font-semibold text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map(({ node: tx }: any) => (
              <tr key={tx.hash} className="hover:bg-muted/50 transition-colors group">
                <td className="px-6 py-4">
                  {tx.successful ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </td>
                <td className="px-6 py-4 font-mono text-sm">
                  <span className="text-primary truncate w-32 block">
                    {tx.hash.substring(0, 12)}...
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium">{tx.ledger}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground italic">
                  {tx.sourceAccount.substring(0, 4)}...{tx.sourceAccount.substring(52)}
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground text-right whitespace-nowrap">
                  {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
