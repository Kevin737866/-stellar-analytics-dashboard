import { useQuery } from '@apollo/client';
import { ASSET_METRICS_QUERY } from '@/graphql/queries';
import { DataTable } from '@/components/DataTable';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Coins, ArrowRightLeft, DollarSign } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

export function Assets() {
  const { data, loading } = useQuery(ASSET_METRICS_QUERY, {
    variables: { first: 10, timeRange: { last: '24h' } },
  });

  const assets = data?.assetMetrics || [];

  // Data for the Volume Bar Chart
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
            <div className="font-bold">
              {item.asset.native ? 'Stellar Lumens' : item.asset.assetCode}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              {item.asset.native
                ? 'Native'
                : `${item.asset.assetIssuer.slice(0, 4)}...${item.asset.assetIssuer.slice(-4)}`}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: '24h Volume',
      accessor: (item: any) => (
        <span className="font-medium">{parseFloat(item.volume24h).toLocaleString()} XLM</span>
      ),
    },
    {
      header: 'Trades (24h)',
      accessor: 'trades24h' as const,
    },
    {
      header: 'Price Change',
      accessor: (item: any) => {
        const change = parseFloat(item.priceChange24h || '0');
        return (
          <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </span>
        );
      },
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DEX Explorer</h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Market liquidity and asset performance
          </p>
        </div>
      </div>

      {/* Market Pulse Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard title="Total Assets" value={assets.length} icon={Coins} />
        <MetricCard
          title="24h Volume"
          value="4.2M"
          icon={DollarSign}
          format="currency"
          changeLabel="XLM"
        />
        <MetricCard
          title="Total Trades"
          value="12.4k"
          icon={ArrowRightLeft}
          change={12}
          changeLabel="vs yesterday"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="chart-container lg:col-span-1">
          <h3 className="text-lg font-semibold mb-6 text-foreground">Volume Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: -20 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                  }}
                />
                <Bar dataKey="volume" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((_: any, index: number) => (
                    <Cell key={index} fill={`hsl(var(--primary) / ${1 - index * 0.1})`} />
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
