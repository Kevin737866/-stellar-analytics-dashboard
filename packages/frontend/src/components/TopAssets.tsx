import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@apollo/client';
import { ASSET_METRICS_QUERY } from '@/graphql/queries';

export function TopAssets() {
  const { data, loading } = useQuery(ASSET_METRICS_QUERY, {
    variables: { first: 5, timeRange: { last: '24h' } },
  });

  if (loading) return <div className="h-80 loading-skeleton rounded-lg" />;

  const chartData =
    data?.assetMetrics?.map((m: any) => ({
      name: m.asset.native ? 'XLM' : m.asset.assetCode,
      volume: parseFloat(m.volume24h),
    })) || [];

  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold mb-6">Top Assets by 24h Volume</h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 30 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              width={60}
              tick={{ fill: 'hsl(var(--foreground))', fontWeight: 500 }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
            />
            <Bar dataKey="volume" radius={[0, 4, 4, 0]} barSize={32}>
              {chartData.map((_: any, index: number) => (
                <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.15})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
