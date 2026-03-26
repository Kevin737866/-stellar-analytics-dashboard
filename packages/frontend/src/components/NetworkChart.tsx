import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useQuery } from '@apollo/client';
import { NETWORK_METRICS_QUERY } from '@/graphql/queries';

export function NetworkChart() {
  const { data, loading } = useQuery(NETWORK_METRICS_QUERY, {
    variables: { timeRange: { last: '24h' } },
  });

  if (loading) return <div className="h-80 loading-skeleton rounded-lg" />;

  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold mb-4">Transaction Volume (24h)</h3>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data?.networkMetrics}>
            <defs>
              <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(str) => new Date(str).toLocaleTimeString([], { hour: '2-digit' })}
              stroke="#888888"
              fontSize={12}
            />
            <YAxis stroke="#888888" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
              labelFormatter={(label) => new Date(label).toLocaleString()}
            />
            <Area
              type="monotone"
              dataKey="transactionCount"
              stroke="var(--primary)"
              fillOpacity={1}
              fill="url(#colorVol)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
