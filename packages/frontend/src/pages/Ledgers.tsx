import { useQuery } from '@apollo/client';
import { LEDGERS_QUERY } from '@/graphql/queries';
import { DataTable } from '@/components/DataTable';
import { formatDistanceToNow } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Database, Activity, Cpu } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

export function Ledgers() {
  const { data, loading, fetchMore } = useQuery(LEDGERS_QUERY, {
    variables: { first: 20 },
    pollInterval: 5000,
  });

  const ledgers = data?.ledgers?.edges.map((e: any) => e.node) || [];
  const pageInfo = data?.ledgers?.pageInfo;

  // Real-time Chart Mapping
  const chartData = [...ledgers].reverse().map((l: any) => ({
    sequence: l.sequence,
    txCount: l.transactionCount,
    ops: l.operationCount,
  }));

  const columns = [
    {
      header: 'Sequence',
      accessor: (l: any) => (
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary/60" />
          <span className="font-mono font-bold text-primary">#{l.sequence}</span>
        </div>
      ),
    },
    {
      header: 'Tx Density',
      accessor: (l: any) => (
        <div className="flex flex-col">
          <span className="font-semibold">{l.transactionCount} txs</span>
          <div className="w-24 h-1 bg-muted rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min((l.transactionCount / 50) * 100, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      header: 'Operations',
      accessor: (l: any) => (
        <div className="flex items-center gap-2">
          <span className="text-green-500 font-medium">{l.successfulOperationCount}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-red-500 font-medium">{l.failedOperationCount}</span>
        </div>
      ),
    },
    {
      header: 'Time',
      accessor: (l: any) => formatDistanceToNow(new Date(l.closedAt), { addSuffix: true }),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ledger Chain</h1>
          <p className="text-muted-foreground mt-1">Live immutable records from the network</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">
            Live Syncing
          </span>
        </div>
      </div>

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
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
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
            value={ledgers[0]?.sequence?.toLocaleString() || '...'}
            icon={Database}
          />
          <MetricCard title="Protocol Version" value="21" icon={Cpu} changeLabel="Active" />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={ledgers}
        loading={loading}
        hasNextPage={pageInfo?.hasNextPage}
        onNextPage={() => fetchMore({ variables: { after: pageInfo?.endCursor } })}
      />
    </div>
  );
}
