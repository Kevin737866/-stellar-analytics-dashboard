import { useQuery } from '@apollo/client';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { NETWORK_METRICS_QUERY } from '@/graphql/queries';
import { Activity, Zap, ShieldCheck, Clock } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function Network() {
  const { data, loading } = useQuery(NETWORK_METRICS_QUERY, {
    variables: { timeRange: { last: '24h' } },
  });

  // Mock data for Operation Distribution (until backend provides specific breakdown)
  const opData = [
    { name: 'Payments', value: 400 },
    { name: 'Create Account', value: 300 },
    { name: 'Manage Sell Offer', value: 300 },
    { name: 'Change Trust', value: 200 },
  ];

  if (loading)
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-32 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-muted rounded-xl" />
          <div className="h-80 bg-muted rounded-xl" />
        </div>
      </div>
    );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Network Performance</h1>
        <p className="text-muted-foreground mt-2 font-medium">Live protocol-level metrics</p>
      </div>

      {/* Real-time Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Avg Close Time"
          value="5.2s"
          icon={Clock}
          changeLabel="Network Latency"
        />
        <MetricCard title="Protocol Version" value="20" icon={ShieldCheck} changeLabel="Stable" />
        <MetricCard title="Success Rate" value="99.9%" icon={Zap} format="percentage" />
        <MetricCard
          title="Ledgers (24h)"
          value={data?.networkMetrics?.length || 0}
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ledger Close Times (Area Chart) */}
        <div className="chart-container">
          <h3 className="text-lg font-semibold mb-6">Ledger Close Times (Seconds)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.networkMetrics}>
                <defs>
                  <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="timestamp" hide />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                  }}
                />
                <Area
                  type="step"
                  dataKey="ledgerCount"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url( #colorClose )"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operation Type Distribution (Pie Chart) */}
        <div className="chart-container">
          <h3 className="text-lg font-semibold mb-6">Operation Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={opData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {opData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
