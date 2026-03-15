/**
 * Stellar network constants
 */
export const STELLAR_NETWORKS = {
  PUBLIC: 'public',
  TESTNET: 'testnet',
} as const;

export const HORIZON_URLS = {
  [STELLAR_NETWORKS.PUBLIC]: 'https://horizon.stellar.org',
  [STELLAR_NETWORKS.TESTNET]: 'https://horizon-testnet.stellar.org',
} as const;

export const STELLAR_ASSET = {
  NATIVE: 'XLM',
  TYPE: {
    NATIVE: 'native',
    CREDIT_ALPHANUM4: 'credit_alphanum4',
    CREDIT_ALPHANUM12: 'credit_alphanum12',
  },
} as const;

/**
 * Database constants
 */
export const DATABASE = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  CONNECTION_TIMEOUT: 30000,
  QUERY_TIMEOUT: 10000,
} as const;

export const TABLES = {
  LEDGERS: 'ledgers',
  TRANSACTIONS: 'transactions',
  OPERATIONS: 'operations',
  ACCOUNTS: 'accounts',
  ASSETS: 'assets',
  TRUSTLINES: 'trustlines',
  NETWORK_METRICS: 'network_metrics',
  ASSET_METRICS: 'asset_metrics',
  ACCOUNT_METRICS: 'account_metrics',
} as const;

/**
 * API constants
 */
export const API = {
  VERSION: 'v1',
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 1000,
  WEBSOCKET_PING_INTERVAL: 30000, // 30 seconds
  WEBSOCKET_MESSAGE_QUEUE_SIZE: 1000,
} as const;

export const ENDPOINTS = {
  HEALTH: '/health',
  GRAPHQL: '/graphql',
  SUBSCRIPTIONS: '/subscriptions',
  METRICS: '/metrics',
} as const;

/**
 * Cache constants
 */
export const CACHE = {
  DEFAULT_TTL: 300, // 5 minutes
  METRICS_TTL: 60, // 1 minute
  ACCOUNT_TTL: 600, // 10 minutes
  ASSET_TTL: 1800, // 30 minutes
  TRANSACTION_TTL: 3600, // 1 hour
} as const;

/**
 * Indexer constants
 */
export const INDEXER = {
  POLL_INTERVAL: 5000, // 5 seconds
  BATCH_SIZE: 100,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  BACKFILL_BATCH_SIZE: 1000,
  WEBSOCKET_RECONNECT_DELAY: 5000, // 5 seconds
  WEBSOCKET_MAX_RECONNECT_ATTEMPTS: 10,
} as const;

/**
 * Operation types for analytics
 */
export const PAYMENT_OPERATIONS = [
  'payment',
  'path_payment_strict_receive',
  'path_payment_strict_send',
] as const;

export const TRUSTLINE_OPERATIONS = [
  'change_trust',
  'allow_trust',
  'set_trust_line_flags',
  'clawback',
  'clawback_claimable_balance',
] as const;

export const ACCOUNT_OPERATIONS = [
  'create_account',
  'set_options',
  'account_merge',
  'bump_sequence',
  'begin_sponsoring_future_reserves',
  'end_sponsoring_future_reserves',
  'revoke_sponsorship',
] as const;

export const DEX_OPERATIONS = [
  'manage_sell_offer',
  'manage_buy_offer',
  'create_passive_sell_offer',
  'liquidity_pool_deposit',
  'liquidity_pool_withdraw',
] as const;

export const SOROBAN_OPERATIONS = [
  'invoke_host_function',
] as const;

export const DATA_OPERATIONS = [
  'manage_data',
  'claim_claimable_balance',
] as const;

/**
 * Memo types
 */
export const MEMO_TYPES = {
  NONE: 'none',
  TEXT: 'text',
  ID: 'id',
  HASH: 'hash',
  RETURN: 'return',
} as const;

/**
 * Time ranges for analytics
 */
export const TIME_RANGES = {
  HOUR: '1h',
  DAY: '24h',
  WEEK: '7d',
  MONTH: '30d',
  QUARTER: '90d',
  YEAR: '365d',
} as const;

/**
 * WebSocket message types
 */
export const WS_MESSAGE_TYPES = {
  LEDGER: 'ledger',
  TRANSACTION: 'transaction',
  OPERATION: 'operation',
  METRICS: 'metrics',
  ERROR: 'error',
  PING: 'ping',
  PONG: 'pong',
} as const;

/**
 * Error codes
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
} as const;

/**
 * Status codes
 */
export const STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
