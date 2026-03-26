import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { Users, ArrowRightLeft, TrendingUp, DollarSign } from 'lucide-react';

import { STATS_QUERY } from '@/graphql/queries';
import { MetricCard } from '@/components/MetricCard';
import { NetworkChart } from '@/components/NetworkChart';
import { RecentTransactions } from '@/components/RecentTransactions';
import { TopAssets } from '@/components/TopAssets';

import { NEW_LEDGER_SUBSCRIPTION } from '@/graphql/queries';
import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface StatsData {
  stats: {
    totalLedgers: number;
    totalTransactions: number;
    totalOperations: number;
    totalAccounts: number;
    totalAssets: number;
    activeAccounts24h: number;
    activeAccounts7d: number;
    activeAccounts30d: number;
    volume24h: string;
    volume7d: string;
    volume30d: string;
    averageFee24h: number;
    successRate24h: number;
    latestLedger: number;
    latestLedgerTime: string;
  };
}

interface LedgerAddedSubscriptionData {
  ledgerAdded: {
    sequence: number;
    closedAt: string;
    operationCount: number;
    successfulTransactionCount: number;
  };
}

export function Dashboard() {
  const { data, loading, error, subscribeToMore } = useQuery<StatsData>(STATS_QUERY);

  useEffect(() => {
    subscribeToMore<LedgerAddedSubscriptionData>({
      document: NEW_LEDGER_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;

        const newLedger = subscriptionData.data.ledgerAdded;

        return {
          stats: {
            ...prev.stats,
            latestLedger: newLedger.sequence,
            latestLedgerTime: newLedger.closedAt,
            totalTransactions:
              prev.stats.totalTransactions + (newLedger.successfulTransactionCount || 0),
            totalOperations: prev.stats.totalOperations + (newLedger.operationCount || 0),
          },
        };
      },
    });
  }, [subscribeToMore]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 loading-skeleton" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 loading-skeleton" />
          <div className="h-96 loading-skeleton" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-destructive mb-2">
          Error loading dashboard data
        </h2>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  const stats = data?.stats;

  const metrics = [
    {
      title: 'Total Transactions',
      value: stats?.totalTransactions ?? 0,
      icon: ArrowRightLeft,
      change: stats?.activeAccounts24h,
      changeLabel: '24h active accounts',
      format: 'number' as const,
    },
    {
      title: 'Network Success Rate',
      value: stats?.successRate24h ?? 0,
      icon: TrendingUp,
      change: 0,
      changeLabel: '24h average',
      format: 'percentage' as const,
    },
    {
      title: '24h Volume',
      value: stats?.volume24h ?? '0',
      icon: DollarSign,
      change: undefined, // Explicitly set to undefined
      changeLabel: 'XLM Volume',
      format: 'currency' as const,
    },
    {
      title: 'Total Accounts',
      value: stats?.totalAccounts ?? 0,
      icon: Users,
      change: stats?.activeAccounts24h,
      changeLabel: 'New active today',
      format: 'number' as const,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Real-time overview of the Stellar network</p>
      </div>

      {/* Status Bar */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Network Live</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <motion.span
              key={stats?.latestLedger} // Key change triggers the animation
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono"
            >
              {stats?.latestLedger}
            </motion.span>
            <div>
              {stats?.latestLedgerTime &&
                format(new Date(stats.latestLedgerTime), 'MMM dd, HH:mm:ss')}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NetworkChart />
        <TopAssets />
      </div>

      {/* Recent Transactions */}
      <RecentTransactions />
    </div>
  );
}
