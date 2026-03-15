import { z } from 'zod';

// Base Stellar types
export const AssetTypeSchema = z.enum(['native', 'credit_alphanum4', 'credit_alphanum12']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetSchema = z.object({
  asset_type: AssetTypeSchema,
  asset_code: z.string().optional(),
  asset_issuer: z.string().optional(),
  native: z.boolean().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AccountSchema = z.object({
  account_id: z.string(),
  balance: z.string(),
  asset_type: AssetTypeSchema,
  asset_code: z.string().optional(),
  asset_issuer: z.string().optional(),
  buying_liabilities: z.string(),
  selling_liabilities: z.string(),
  last_modified_ledger: z.number(),
  is_authorized: z.boolean(),
  is_authorized_to_maintain_liabilities: z.boolean(),
  is_clawback_enabled: z.boolean(),
});
export type Account = z.infer<typeof AccountSchema>;

export const TransactionSchema = z.object({
  id: z.string(),
  paging_token: z.string(),
  successful: z.boolean(),
  hash: z.string(),
  ledger: z.number(),
  created_at: z.string(),
  source_account: z.string(),
  source_account_sequence: z.string(),
  fee_account: z.string(),
  fee_charged: z.number(),
  max_fee: z.number(),
  operation_count: z.number(),
  envelope_xdr: z.string(),
  result_xdr: z.string(),
  result_meta_xdr: z.string(),
  fee_meta_xdr: z.string(),
  memo_type: z.string().optional(),
  memo: z.string().optional(),
  signatures: z.array(z.string()),
  valid_after: z.string().optional(),
  valid_before: z.string().optional(),
  fee_bump_transaction: z.boolean().optional(),
  inner_transaction: z.object({
    hash: z.string(),
    signatures: z.array(z.string()),
  }).optional(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const OperationTypeSchema = z.enum([
  'create_account',
  'payment',
  'path_payment_strict_receive',
  'path_payment_strict_send',
  'manage_sell_offer',
  'manage_buy_offer',
  'create_passive_sell_offer',
  'set_options',
  'change_trust',
  'allow_trust',
  'account_merge',
  'inflation',
  'manage_data',
  'bump_sequence',
  'claim_claimable_balance',
  'begin_sponsoring_future_reserves',
  'end_sponsoring_future_reserves',
  'revoke_sponsorship',
  'clawback',
  'clawback_claimable_balance',
  'set_trust_line_flags',
  'liquidity_pool_deposit',
  'liquidity_pool_withdraw',
  'invoke_host_function',
]);
export type OperationType = z.infer<typeof OperationTypeSchema>;

export const OperationSchema = z.object({
  id: z.string(),
  paging_token: z.string(),
  transaction_hash: z.string(),
  transaction_successful: z.boolean(),
  type: OperationTypeSchema,
  created_at: z.string(),
  source_account: z.string(),
  transaction: z.object({
    hash: z.string(),
    successful: z.boolean(),
    ledger: z.number(),
  }),
});
export type Operation = z.infer<typeof OperationSchema>;

export const LedgerSchema = z.object({
  id: z.string(),
  paging_token: z.string(),
  sequence: z.number(),
  successful_transaction_count: z.number(),
  failed_transaction_count: z.number(),
  operation_count: z.number(),
  tx_set_operation_count: z.number(),
  closed_at: z.string(),
  total_coins: z.string(),
  fee_pool: z.string(),
  base_fee_in_stroops: z.number(),
  base_reserve_in_stroops: z.number(),
  max_tx_set_size: z.number(),
  protocol_version: z.number(),
  header_xdr: z.string(),
});
export type Ledger = z.infer<typeof LedgerSchema>;

// Soroban specific types
export const SorobanTransactionDataSchema = z.object({
  resources: z.object({
    footprint: z.object({
      read_only: z.array(z.string()),
      read_write: z.array(z.string()),
    }),
    instructions: z.number(),
    read_bytes: z.number(),
    write_bytes: z.number(),
  }),
  ext: z.object({
    v: z.number(),
  }),
});
export type SorobanTransactionData = z.infer<typeof SorobanTransactionDataSchema>;

export const SorobanAuthorizedInvocationSchema = z.object({
  function: z.object({
    contract_address: z.string(),
    function_name: z.string(),
    arguments: z.array(z.unknown()),
  }),
  sub_invocations: z.array(z.unknown()),
});
export type SorobanAuthorizedInvocation = z.infer<typeof SorobanAuthorizedInvocationSchema>;

// Analytics specific types
export const NetworkMetricsSchema = z.object({
  timestamp: z.string(),
  ledger_count: z.number(),
  transaction_count: z.number(),
  operation_count: z.number(),
  active_accounts: z.number(),
  total_volume: z.string(),
  average_fee: z.number(),
  success_rate: z.number(),
});
export type NetworkMetrics = z.infer<typeof NetworkMetricsSchema>;

export const AssetMetricsSchema = z.object({
  asset: AssetSchema,
  volume_24h: z.string(),
  volume_7d: z.string(),
  volume_30d: z.string(),
  trades_24h: z.number(),
  trades_7d: z.number(),
  trades_30d: z.number(),
  price_change_24h: z.number(),
  market_cap: z.string().optional(),
  holders: z.number(),
});
export type AssetMetrics = z.infer<typeof AssetMetricsSchema>;

export const AccountMetricsSchema = z.object({
  account_id: z.string(),
  balance_native: z.string(),
  total_balance_usd: z.string(),
  transaction_count_24h: z.number(),
  transaction_count_7d: z.number(),
  transaction_count_30d: z.number(),
  first_transaction: z.string(),
  last_transaction: z.string(),
  is_active: z.boolean(),
  trustlines: z.number(),
  signers: z.number(),
});
export type AccountMetrics = z.infer<typeof AccountMetricsSchema>;

// Database types
export const DatabaseLedgerSchema = LedgerSchema.extend({
  created_at: z.string(),
  updated_at: z.string(),
});
export type DatabaseLedger = z.infer<typeof DatabaseLedgerSchema>;

export const DatabaseTransactionSchema = TransactionSchema.extend({
  created_at: z.string(),
  updated_at: z.string(),
});
export type DatabaseTransaction = z.infer<typeof DatabaseTransactionSchema>;

export const DatabaseOperationSchema = OperationSchema.extend({
  created_at: z.string(),
  updated_at: z.string(),
});
export type DatabaseOperation = z.infer<typeof DatabaseOperationSchema>;
