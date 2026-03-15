import React from 'react'
import { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  change?: number
  changeLabel?: string
  format?: 'number' | 'currency' | 'percentage'
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  format = 'number',
}: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') {
      if (format === 'currency') {
        return parseFloat(val).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      }
      return val
    }

    if (format === 'currency') {
      return val.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    if (format === 'percentage') {
      return val.toString()
    }

    return val.toLocaleString()
  }

  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">
              {formatValue(value)}
            </p>
          </div>
        </div>
      </div>
      
      {change !== undefined && changeLabel && (
        <div className="mt-4 flex items-center gap-2">
          {isPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
          {isNegative && <TrendingDown className="h-4 w-4 text-red-500" />}
          <span className={`text-sm ${
            isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground'
          }`}>
            {changeLabel}
          </span>
        </div>
      )}
    </div>
  )
}
