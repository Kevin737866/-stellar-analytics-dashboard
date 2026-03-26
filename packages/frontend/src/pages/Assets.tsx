import { useQuery } from '@apollo/client';
import { ASSET_METRICS_QUERY } from '@/graphql/queries';
import { DataTable } from '@/components/DataTable';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Coins, ArrowRightLeft, DollarSign, RefreshCcw } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

export function Assets() {
  const { data, loading, refetch } = useQuery(ASSET_METRICS_QUERY, {
    variables: { first: 10, timeRange: { last: '24h' } },
    pollInterval: 30000,
    notifyOnNetworkStatusChange: true,
  });

  const assets = data?.assetMetrics || [];

  const totalVolume = assets.reduce(
    (acc: number, curr: any) => acc + parseFloat(curr.volume24h),
    0
  );
  const totalTrades = assets.reduce((acc: number, curr: any) => acc + (curr.trades24h || 0), 0);

  const chartData = assets.map((m: any) => ({
    name: m.asset.native ? 'XLM' : m.asset.assetCode,
    volume: parseFloat(m.volume24h),
  }));

  const columns = [
    {
      header: 'Asset',
      accessor: (item: any) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary border border-primary/20">
            {item.asset.native ? 'X' : item.asset.assetCode[0]}
          </div>
          <div>
            <div className="font-bold text-sm">
              {item.asset.native ? 'Stellar Lumens' : item.asset.assetCode}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {item.asset.native
                ? 'Native'
                : `${item.asset.assetIssuer.slice(0, 6)}...${item.asset.assetIssuer.slice(-4)}`}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: '24h Volume',
      accessor: (item: any) => (
        <span className="font-mono text-sm">{parseFloat(item.volume24h).toLocaleString()} XLM</span>
      ),
    },
    {
      header: 'Trades (24h)',
      accessor: (item: any) => (
        <span className="font-medium">{item.trades24h?.toLocaleString()}</span>
      ),
    },
    {
      header: 'Price Change',
      accessor: (item: any) => {
        const change = parseFloat(item.priceChange24h || '0');
        return (
          <span className={`text-xs font-bold ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
          </span>
        );
      },
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DEX Explorer</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <p className="text-muted-foreground text-sm font-medium">Live market liquidity</p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-secondary/50 text-secondary-foreground rounded-lg hover:bg-secondary transition-all border border-border"
        >
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="text-xs font-bold uppercase tracking-wider">Update Markets</span>
        </button>
      </div>

      {/* Market Pulse Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Tracked Assets" value={assets.length} icon={Coins} />
        <MetricCard
          title="Global 24h Volume"
          value={
            totalVolume > 1000000
              ? `${(totalVolume / 1000000).toFixed(2)}M`
              : totalVolume.toLocaleString()
          }
          icon={DollarSign}
          changeLabel="XLM Total"
        />
        <MetricCard
          title="Network Trades"
          value={totalTrades.toLocaleString()}
          icon={ArrowRightLeft}
          changeLabel="24h activity"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm lg:col-span-1">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-8">
            Volume Leaders
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: -10, right: 20 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 11, fontWeight: 600 }}
                  width={60}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="volume" radius={[0, 4, 4, 0]} barSize={18}>
                  {chartData.map((_entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        index === 0
                          ? 'hsl(var(--primary))'
                          : `hsl(var(--primary) / ${Math.max(0.3, 1 - index * 0.15)})`
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2">
          <DataTable columns={columns} data={assets} loading={loading} />
        </div>
      </div>
    </div>
  );
}
