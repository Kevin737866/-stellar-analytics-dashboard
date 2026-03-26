import { useQuery } from '@apollo/client';
import { format } from 'date-fns';
import { Users, ArrowRightLeft, TrendingUp, DollarSign } from 'lucide-react';
import { useEffect } from 'react';
import { motion } from 'framer-motion';

import { STATS_QUERY, NEW_LEDGER_SUBSCRIPTION } from '@/graphql/queries';
import { MetricCard } from '@/components/MetricCard';
import { NetworkChart } from '@/components/NetworkChart';
import { RecentTransactions } from '@/components/RecentTransactions';
import { TopAssets } from '@/components/TopAssets';

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
    const unsubscribe = subscribeToMore<LedgerAddedSubscriptionData>({
      document: NEW_LEDGER_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        if (!subscriptionData.data) return prev;

        const newLedger = subscriptionData.data.ledgerAdded;

        return {
          stats: {
            ...prev.stats,
            latestLedger: newLedger.sequence,
            latestLedgerTime: newLedger.closedAt,
            // Keep total ledgers in sync with the sequence
            totalLedgers: Math.max(prev.stats.totalLedgers, newLedger.sequence),
            totalTransactions:
              prev.stats.totalTransactions + (newLedger.successfulTransactionCount || 0),
            totalOperations: prev.stats.totalOperations + (newLedger.operationCount || 0),
          },
        };
      },
    });
    return () => unsubscribe();
  }, [subscribeToMore]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted/50 animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-muted/50 animate-pulse rounded-xl" />
          <div className="h-96 bg-muted/50 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 border border-destructive/20 bg-destructive/5 rounded-xl">
        <h2 className="text-xl font-bold text-destructive mb-2">Network Sync Error</h2>
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
      changeLabel: 'Active Accounts (24h)',
      format: 'number' as const,
    },
    {
      title: 'Success Rate',
      value: stats?.successRate24h ?? 0,
      icon: TrendingUp,
      change: 0,
      changeLabel: 'Network Stability',
      format: 'percentage' as const,
    },
    {
      title: '24h Volume',
      value: stats?.volume24h ?? '0',
      icon: DollarSign,
      change: undefined,
      changeLabel: 'XLM Volume',
      format: 'currency' as const,
    },
    {
      title: 'Total Accounts',
      value: stats?.totalAccounts ?? 0,
      icon: Users,
      change: stats?.activeAccounts24h,
      changeLabel: 'New activity detected',
      format: 'number' as const,
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Network Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time Stellar Protocol monitoring</p>
        </div>

        <div className="bg-card px-4 py-2 rounded-lg border border-border shadow-sm flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-widest">Live</span>
          </div>
          <div className="h-4 w-[1px] bg-border" />
          <div className="flex flex-col items-end">
            <motion.span
              key={stats?.latestLedger}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-mono font-bold text-primary"
            >
              #{stats?.latestLedger}
            </motion.span>
            <span className="text-[10px] text-muted-foreground font-medium">
              {stats?.latestLedgerTime && format(new Date(stats.latestLedgerTime), 'HH:mm:ss')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NetworkChart />
        <TopAssets />
      </div>

      <RecentTransactions />
    </div>
  );
}
