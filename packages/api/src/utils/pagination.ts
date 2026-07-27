import { SortArgs } from '@stellar-analytics/shared';

export const DB_COLUMN_MAP: Record<string, string> = {
  sequence: 'sequence',
  closedAt: 'closed_at',
  successfulTransactionCount: 'successful_transaction_count',
  failedTransactionCount: 'failed_transaction_count',
  operationCount: 'operation_count',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  feeCharged: 'fee_charged',
  sourceAccount: 'source_account',
  successful: 'successful',
  type: 'type',
  ledger: 'ledger_sequence',
  operationIndex: 'operation_index',
  balance: 'balance',
  lastModifiedLedger: 'last_modified_ledger',
  sequenceNumber: 'sequence_number',
  assetType: 'asset_type',
  assetCode: 'asset_code',
  timestamp: 'timestamp',
  ledgerCount: 'ledger_count',
  transactionCount: 'transaction_count',
  activeAccounts: 'active_accounts',
  totalVolume: 'total_volume',
  volume24h: 'volume_24h',
  trades24h: 'trades_24h',
  priceChange24h: 'price_change_24h',
  holders: 'holders',
  transactionCount24h: 'transaction_count_24h',
  transactionCount7d: 'transaction_count_7d',
  balanceNative: 'balance_native',
  lastTransaction: 'last_transaction',
};

export function buildOrderBy(sort: SortArgs | null, defaultOrderBy: string): string {
  if (!sort || sort.length === 0) {
    return `ORDER BY ${defaultOrderBy}`;
  }

  const clauses = sort.map((item) => {
    const column = DB_COLUMN_MAP[item.field] || item.field;
    return `${column} ${item.direction}`;
  });

  return `ORDER BY ${clauses.join(', ')}`;
}
