import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@apollo/client'
import { TRANSACTIONS_QUERY } from '../graphql/queries'
import { useFilterSort } from '../hooks/useFilterSort'
import { DataTable, Column } from '../components/DataTable'

interface TransactionRow {
  hash: string
  successful: boolean
  ledger: number
  createdAt: string
  sourceAccount: string
  feeCharged: number
  operationCount: number
  memoType?: string
}

function clientSort(data: TransactionRow[], sortEntries: { field: string; direction: 'ASC' | 'DESC' }[]): TransactionRow[] {
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

export function Transactions() {
  const [searchParams] = useSearchParams()
  const { sortEntries, handleSort } = useFilterSort(searchParams)

  const { data, loading } = useQuery(TRANSACTIONS_QUERY, {
    variables: {
      first: 50,
      sort: sortEntries,
    },
  })

  const raw: TransactionRow[] = data?.transactions?.edges?.map((e: any) => ({
    hash: e.node.hash,
    successful: e.node.successful,
    ledger: e.node.ledger,
    createdAt: e.node.createdAt,
    sourceAccount: e.node.sourceAccount,
    feeCharged: e.node.feeCharged,
    operationCount: e.node.operationCount,
    memoType: e.node.memoType,
  })) ?? []

  const sorted = clientSort(raw, sortEntries)

  const columns: Column<TransactionRow>[] = [
    { key: 'hash', header: 'Hash', render: (r) => <span className="font-mono text-sm truncate">{r.hash}</span> },
    { key: 'successful', header: 'Status', render: (r) => r.successful ? '✅' : '❌' },
    { key: 'ledger', header: 'Ledger', sortable: true, render: (r) => r.ledger },
    { key: 'createdAt', header: 'Time', sortable: true, render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'sourceAccount', header: 'Source', render: (r) => <span className="font-mono text-sm truncate">{r.sourceAccount}</span> },
    { key: 'feeCharged', header: 'Fee', sortable: true, render: (r) => r.feeCharged },
    { key: 'operationCount', header: 'Ops', sortable: true, render: (r) => r.operationCount },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
        <p className="text-muted-foreground mt-2">
          Explore Stellar blockchain transactions
        </p>
      </div>
      <DataTable
        columns={columns}
        data={sorted}
        sortEntries={sortEntries}
        onSort={handleSort}
        keyExtractor={(r) => r.hash}
        loading={loading}
      />
    </div>
  )
}
