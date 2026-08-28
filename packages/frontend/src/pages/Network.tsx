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
  type TooltipProps,
} from 'recharts';
import { NETWORK_METRICS_QUERY } from '@/graphql/queries';
import { Activity, Zap, ShieldCheck, Clock, RefreshCcw } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';
import { ChartTooltip } from '@/components/ChartTooltip';
import { ChartLegend } from '@/components/ChartLegend';
import { ApiErrorMessage } from '@/components/ApiErrorMessage';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function Network() {
  const { data, loading, error, refetch } = useQuery(NETWORK_METRICS_QUERY, {
    variables: { timeRange: { last: '24h' } },
    pollInterval: 10000,
    notifyOnNetworkStatusChange: true,
  });

  const opData = data?.networkMetrics?.operationDistribution || [
    { name: 'Payments', value: 400 },
    { name: 'Create Account', value: 300 },
    { name: 'Offers', value: 300 },
    { name: 'Trustlines', value: 200 },
  ];

  const metrics = data?.networkMetrics || {};

  function CloseTimeTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as { timestamp: string; closeTime: number } | undefined;
    if (!d) return null;
    return (
      <ChartTooltip
        header={new Date(d.timestamp).toLocaleString()}
        rows={[{ label: 'Close Time', value: `${d.closeTime.toFixed(1)}s`, color: '#3b82f6', dot: true }]}
      />
    );
  }

  function OpDistTooltip({ active, payload }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as { name: string; value: number } | undefined;
    if (!d) return null;
    const total = opData.reduce((sum: number, item: { value: number }) => sum + item.value, 0);
    return (
      <ChartTooltip
        header={d.name}
        rows={[
          { label: 'Count', value: d.value.toLocaleString(), dot: true },
          { label: 'Share', value: `${((d.value / total) * 100).toFixed(1)}%`, color: '#8b5cf6', dot: true },
        ]}
      />
    );
  }

  if (loading && !data)
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-32 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-muted rounded-xl" />
          <div className="h-80 bg-muted rounded-xl" />
        </div>
      </div>
    );

  if (error) {
    return <ApiErrorMessage error={error} onRetry={() => refetch()} className="min-h-[400px]" />;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Network Performance</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <p className="text-muted-foreground font-medium text-sm">Live protocol-level metrics</p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-secondary/50 text-secondary-foreground rounded-lg hover:bg-secondary transition-all border border-border"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          <span className="text-sm font-bold">Refresh Node Data</span>
        </button>
      </div>

      {/* Real-time Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Avg Close Time"
          value={`${metrics.avgCloseTime || '5.2'}s`}
          icon={Clock}
          changeLabel="Network Latency"
        />
        <MetricCard
          title="Protocol Version"
          value={metrics.protocolVersion || '21'}
          icon={ShieldCheck}
          changeLabel="Mainnet-Stable"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate || '99.9'}%`}
          icon={Zap}
          format="percentage"
        />
        <MetricCard
          title="Ledgers (24h)"
          value={(metrics.ledgerHistory?.length || 0).toLocaleString()}
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ledger Close Times (Area Chart) */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Activity className="text-primary h-5 w-5" />
            Ledger Propagation Speed
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.ledgerHistory}>
                <defs>
                  <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="timestamp" hide />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CloseTimeTooltip />} />
                <Area
                  type="monotone"
                  dataKey="closeTime"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorClose)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operation Type Distribution (Pie Chart) */}
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Zap className="text-yellow-500 h-5 w-5" />
            Operation Distribution
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={opData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4}
                >
                  {opData.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<OpDistTooltip />} />
                <ChartLegend items={opData.map((d: { name: string; value: number }, i: number) => ({ label: d.name, color: COLORS[i % COLORS.length] }))} className="pt-5" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
