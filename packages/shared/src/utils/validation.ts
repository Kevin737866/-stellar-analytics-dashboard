import { z } from 'zod';

/**
 * Common validation schemas
 */
export const CursorSchema = z.string().min(1);
export const AddressSchema = z.string().min(1).regex(/^G[A-Z0-9]{55}$/);
export const HashSchema = z.string().min(1).regex(/^[a-fA-F0-9]{64}$/);
export const AssetCodeSchema = z.string().min(1).max(12);
export const AssetIssuerSchema = AddressSchema;

/**
 * Pagination validation
 */
export const PaginationValidationSchema = z.object({
  first: z.number().min(1).max(100).optional(),
  after: CursorSchema.optional(),
  last: z.number().min(1).max(100).optional(),
  before: CursorSchema.optional(),
});

/**
 * Time range validation
 */
export const TimeRangeValidationSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
}).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return new Date(data.startTime) <= new Date(data.endTime);
    }
    return true;
  },
  {
    message: 'startTime must be before endTime',
  }
);

/**
 * Asset filter validation
 */
export const AssetFilterValidationSchema = z.object({
  assetType: z.enum(['native', 'credit_alphanum4', 'credit_alphanum12']).optional(),
  assetCode: AssetCodeSchema.optional(),
  assetIssuer: AssetIssuerSchema.optional(),
}).refine(
  (data) => {
    if (data.assetType === 'native') {
      return !data.assetCode && !data.assetIssuer;
    }
    if (data.assetCode || data.assetIssuer) {
      return data.assetCode && data.assetIssuer;
    }
    return true;
  },
  {
    message: 'For non-native assets, both assetCode and assetIssuer must be provided',
  }
);

/**
 * Account filter validation
 */
export const AccountFilterValidationSchema = z.object({
  accountId: AddressSchema.optional(),
  minBalance: z.string().regex(/^\d+$/).optional(),
  maxBalance: z.string().regex(/^\d+$/).optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.minBalance && data.maxBalance) {
      return parseInt(data.minBalance) <= parseInt(data.maxBalance);
    }
    return true;
  },
  {
    message: 'minBalance must be less than or equal to maxBalance',
  }
);

/**
 * Transaction filter validation
 */
export const TransactionFilterValidationSchema = z.object({
  successful: z.boolean().optional(),
  minFee: z.number().min(0).optional(),
  maxFee: z.number().min(0).optional(),
  hasMemo: z.boolean().optional(),
  memoType: z.enum(['none', 'text', 'id', 'hash', 'return']).optional(),
}).refine(
  (data) => {
    if (data.minFee && data.maxFee) {
      return data.minFee <= data.maxFee;
    }
    return true;
  },
  {
    message: 'minFee must be less than or equal to maxFee',
  }
);

/**
 * Operation filter validation
 */
export const OperationFilterValidationSchema = z.object({
  type: z.enum([
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
  ]).optional(),
  successful: z.boolean().optional(),
  sourceAccount: AddressSchema.optional(),
});

/**
 * Environment variable validation
 */
export const EnvValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_NETWORK: z.enum(['public', 'testnet']),
  JWT_SECRET: z.string().min(32),
  PORT: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(65535)),
});

/**
 * Validation helper functions
 */
export function validateCursor(cursor: unknown): string {
  return CursorSchema.parse(cursor);
}

export function validateAddress(address: unknown): string {
  return AddressSchema.parse(address);
}

export function validateHash(hash: unknown): string {
  return HashSchema.parse(hash);
}

export function validatePagination(args: unknown) {
  return PaginationValidationSchema.parse(args);
}

export function validateTimeRange(args: unknown) {
  return TimeRangeValidationSchema.parse(args);
}

export function validateAssetFilter(args: unknown) {
  return AssetFilterValidationSchema.parse(args);
}

export function validateAccountFilter(args: unknown) {
  return AccountFilterValidationSchema.parse(args);
}

export function validateTransactionFilter(args: unknown) {
  return TransactionFilterValidationSchema.parse(args);
}

export function validateOperationFilter(args: unknown) {
  return OperationFilterValidationSchema.parse(args);
}

export function validateEnv(env: unknown) {
  return EnvValidationSchema.parse(env);
}

/**
 * Safe validation with error handling
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors.map(e => e.message).join(', ') };
}
