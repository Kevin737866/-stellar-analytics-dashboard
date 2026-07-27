import { SortArgs, SortArgsSchema } from '@stellar-analytics/shared';

const ALLOWED_SORT_FIELDS: Record<string, string[]> = {
  ledger: ['sequence', 'closedAt', 'successfulTransactionCount', 'failedTransactionCount', 'operationCount', 'createdAt', 'updatedAt'],
  transaction: ['createdAt', 'feeCharged', 'operationCount', 'successful', 'sourceAccount'],
  operation: ['createdAt', 'type', 'sourceAccount', 'ledger', 'operationIndex'],
  account: ['balance', 'createdAt', 'updatedAt', 'lastModifiedLedger', 'sequenceNumber'],
  asset: ['assetType', 'assetCode', 'createdAt', 'updatedAt'],
  networkMetric: ['timestamp', 'ledgerCount', 'transactionCount', 'operationCount', 'activeAccounts', 'totalVolume'],
  assetMetric: ['volume24h', 'trades24h', 'priceChange24h', 'holders'],
  accountMetric: ['transactionCount24h', 'transactionCount7d', 'balanceNative', 'lastTransaction'],
};

export class ValidationService {
  static validateSort(
    sort: any[] | null | undefined,
    entity: keyof typeof ALLOWED_SORT_FIELDS
  ): SortArgs | null {
    if (!sort || sort.length === 0) return null;

    const allowedFields = ALLOWED_SORT_FIELDS[entity];
    if (!allowedFields) return null;

    const parsed = SortArgsSchema.safeParse(sort);
    if (!parsed.success) {
      throw new Error(`Invalid sort input: ${parsed.error.issues.map(i => i.message).join(', ')}`);
    }

    for (const item of parsed.data) {
      if (!allowedFields.includes(item.field)) {
        throw new Error(
          `Field '${item.field}' is not sortable for ${entity}. Allowed: ${allowedFields.join(', ')}`
        );
      }
    }

    return parsed.data;
  }
}
