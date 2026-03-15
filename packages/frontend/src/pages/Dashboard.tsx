import React from 'react'
import { useQuery } from '@apollo/client'
import { format } from 'date-fns'
import { 
  Activity, 
  Users, 
  ArrowRightLeft, 
  TrendingUp,
  Clock,
  DollarSign
} from 'lucide-react'

import { STATS_QUERY } from '@/graphql/queries'
import { MetricCard } from '@/components/MetricCard'
import { NetworkChart } from '@/components/NetworkChart'
import { RecentTransactions } from '@/components/RecentTransactions'
import { TopAssets } from '@/components/TopAssets'

interface StatsData {
  stats: {
    totalLedgers: number
    totalTransactions: number
    totalOperations: number
    totalAccounts: number
    totalAssets: number
    activeAccounts24h: number
    activeAccounts7d: number
    activeAccounts30d: number
    volume24h: string
    volume7d: string
    volume30d: string
    averageFee24h: number
    successRate24h: number
    latestLedger: number
    latestLedgerTime: string
  }
}

export function Dashboard() {
  const { data, loading, error } = useQuery<StatsData>(STATS_QUERY, {
    pollInterval: 30000, // Refresh every 30 seconds
  })

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
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-destructive mb-2">
          Error loading dashboard data
        </h2>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  const stats = data?.stats

  const metrics = [
    {
      title: 'Total Transactions',
      value: stats?.totalTransactions.toLocaleString() || '0',
      icon: ArrowRightLeft,
      change: stats?.activeAccounts24h || 0,
      changeLabel: '24h active accounts',
      format: 'number',
    },
    {
      title: 'Total Accounts',
      value: stats?.totalAccounts.toLocaleString() || '0',
      icon: Users,
      change: stats?.activeAccounts24h || 0,
      changeLabel: '24h active',
      format: 'number',
    },
    {
      title: '24h Volume',
      value: stats?.volume24h || '0',
      icon: DollarSign,
      change: parseFloat(stats?.volume24h || '0'),
      changeLabel: 'XLM',
      format: 'currency',
    },
    {
      title: 'Success Rate',
      value: `${stats?.successRate24h.toFixed(1)}%` || '0%',
      icon: TrendingUp,
      change: stats?.successRate24h || 0,
      changeLabel: '24h success',
      format: 'percentage',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Real-time overview of the Stellar network
        </p>
      </div>

      {/* Status Bar */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Network Live</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Latest Ledger: {stats?.latestLedger}
            </div>
            <div>
              {stats?.latestLedgerTime && 
                format(new Date(stats.latestLedgerTime), 'MMM dd, HH:mm:ss')
              }
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
  )
}
