import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { LEDGERS_QUERY } from '../graphql/queries'
import { useFilterSort } from '../hooks/useFilterSort'
import { DataTable, Column } from '../components/DataTable'

interface LedgerRow {
  sequence: number
  successfulTransactionCount: number
  failedTransactionCount: number
  operationCount: number
  closedAt: string
  protocolVersion: number
}

function clientSort(data: LedgerRow[], sortEntries: { field: string; direction: 'ASC' | 'DESC' }[]): LedgerRow[] {
  const sorted = [...data]
  for (let i = sortEntries.length - 1; i >= 0; i--) {
    const { field, direction } = sortEntries[i]
    sorted.sort((a, b) => {
      const aVal = (a as any)[field]
      const bVal = (b as any)[field]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return direction === 'ASC' ? cmp : -cmp
    })
  }
  return sorted
}

export function Ledgers() {
  const [searchParams] = useSearchParams()
  const { sortEntries, handleSort } = useFilterSort(searchParams)

  const { data, loading } = useQuery(LEDGERS_QUERY, {
    variables: {
      first: 50,
      sort: sortEntries,
    },
  })

  const raw: LedgerRow[] = data?.ledgers?.edges?.map((e: any) => ({
    sequence: e.node.sequence,
    successfulTransactionCount: e.node.successfulTransactionCount,
    failedTransactionCount: e.node.failedTransactionCount,
    operationCount: e.node.operationCount,
    closedAt: e.node.closedAt,
    protocolVersion: e.node.protocolVersion,
  })) ?? []

  const sorted = clientSort(raw, sortEntries)

  const columns: Column<LedgerRow>[] = [
    { key: 'sequence', header: 'Sequence', sortable: true, render: (r) => r.sequence },
    { key: 'successfulTransactionCount', header: 'Successful', sortable: true, render: (r) => r.successfulTransactionCount },
    { key: 'failedTransactionCount', header: 'Failed', sortable: true, render: (r) => r.failedTransactionCount },
    { key: 'operationCount', header: 'Operations', sortable: true, render: (r) => r.operationCount },
    { key: 'closedAt', header: 'Closed At', sortable: true, render: (r) => new Date(r.closedAt).toLocaleString() },
    { key: 'protocolVersion', header: 'Protocol', sortable: true, render: (r) => r.protocolVersion },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ledgers</h1>
        <p className="text-muted-foreground mt-2">
          Explore Stellar blockchain ledgers
        </p>
      </div>
      <DataTable
        columns={columns}
        data={sorted}
        sortEntries={sortEntries}
        onSort={handleSort}
        keyExtractor={(r) => r.sequence.toString()}
        loading={loading}
      />
    </div>
  )
}
