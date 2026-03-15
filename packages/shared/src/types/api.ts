import { z } from 'zod';
import { Asset, AssetMetrics, AccountMetrics, NetworkMetrics, Operation, Transaction, Ledger } from './stellar';

// GraphQL API types
export const PageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.string().nullable(),
  endCursor: z.string().nullable(),
});
export type PageInfo = z.infer<typeof PageInfoSchema>;

export const EdgeSchema = z.object({
  cursor: z.string(),
  node: z.any(),
});
export type Edge = z.infer<typeof EdgeSchema>;

export const ConnectionSchema = z.object({
  edges: z.array(EdgeSchema),
  pageInfo: PageInfoSchema,
  totalCount: z.number(),
});
export type Connection = z.infer<typeof ConnectionSchema>;

// Query arguments
export const PaginationArgsSchema = z.object({
  first: z.number().min(1).max(100).optional(),
  after: z.string().optional(),
  last: z.number().min(1).max(100).optional(),
  before: z.string().optional(),
});
export type PaginationArgs = z.infer<typeof PaginationArgsSchema>;

export const TimeRangeArgsSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});
export type TimeRangeArgs = z.infer<typeof TimeRangeArgsSchema>;

export const AssetFilterArgsSchema = z.object({
  assetType: z.enum(['native', 'credit_alphanum4', 'credit_alphanum12']).optional(),
  assetCode: z.string().optional(),
  assetIssuer: z.string().optional(),
});
export type AssetFilterArgs = z.infer<typeof AssetFilterArgsSchema>;

export const AccountFilterArgsSchema = z.object({
  accountId: z.string().optional(),
  minBalance: z.string().optional(),
  maxBalance: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type AccountFilterArgs = z.infer<typeof AccountFilterArgsSchema>;

export const TransactionFilterArgsSchema = z.object({
  successful: z.boolean().optional(),
  minFee: z.number().optional(),
  maxFee: z.number().optional(),
  hasMemo: z.boolean().optional(),
  memoType: z.string().optional(),
});
export type TransactionFilterArgs = z.infer<typeof TransactionFilterArgsSchema>;

export const OperationFilterArgsSchema = z.object({
  type: z.string().optional(),
  successful: z.boolean().optional(),
  sourceAccount: z.string().optional(),
});
export type OperationFilterArgs = z.infer<typeof OperationFilterArgsSchema>;

// API Response types
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  errors: z.array(z.string()).optional(),
  pagination: PageInfoSchema.optional(),
});
export type ApiResponse = z.infer<typeof ApiResponseSchema>;

export const NetworkStatsResponseSchema = z.object({
  metrics: NetworkMetricsSchema,
  topAssets: z.array(AssetMetricsSchema),
  activeAccounts: z.number(),
  totalTransactions: z.number(),
  totalOperations: z.number(),
});
export type NetworkStatsResponse = z.infer<typeof NetworkStatsResponseSchema>;

export const AccountStatsResponseSchema = z.object({
  metrics: AccountMetricsSchema,
  recentTransactions: z.array(TransactionSchema),
  operations: z.array(OperationSchema),
  balances: z.array(AssetSchema),
});
export type AccountStatsResponse = z.infer<typeof AccountStatsResponseSchema>;

// WebSocket message types
export const WebSocketMessageSchema = z.object({
  type: z.enum(['ledger', 'transaction', 'operation', 'metrics']),
  data: z.any(),
  timestamp: z.string(),
});
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

export const LedgerUpdateMessageSchema = WebSocketMessageSchema.extend({
  type: z.literal('ledger'),
  data: LedgerSchema,
});
export type LedgerUpdateMessage = z.infer<typeof LedgerUpdateMessageSchema>;

export const TransactionUpdateMessageSchema = WebSocketMessageSchema.extend({
  type: z.literal('transaction'),
  data: TransactionSchema,
});
export type TransactionUpdateMessage = z.infer<typeof TransactionUpdateMessageSchema>;

export const OperationUpdateMessageSchema = WebSocketMessageSchema.extend({
  type: z.literal('operation'),
  data: OperationSchema,
});
export type OperationUpdateMessage = z.infer<typeof OperationUpdateMessageSchema>;

export const MetricsUpdateMessageSchema = WebSocketMessageSchema.extend({
  type: z.literal('metrics'),
  data: NetworkMetricsSchema,
});
export type MetricsUpdateMessage = z.infer<typeof MetricsUpdateMessageSchema>;
