import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  # Pagination types
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  type Edge<T> {
    cursor: String!
    node: T!
  }

  type Connection<T> {
    edges: [Edge<T>]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  # Core Stellar types
  type Asset {
    assetType: String!
    assetCode: String
    assetIssuer: String
    native: Boolean
  }

  type Ledger {
    id: String!
    sequence: Int!
    successfulTransactionCount: Int!
    failedTransactionCount: Int!
    operationCount: Int!
    txSetOperationCount: Int!
    closedAt: DateTime!
    totalCoins: String!
    feePool: String!
    baseFeeInStroops: Int!
    baseReserveInStroops: Int!
    maxTxSetSize: Int!
    protocolVersion: Int!
    headerXdr: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Transaction {
    id: String!
    pagingToken: String!
    successful: Boolean!
    hash: String!
    ledger: Int!
    createdAt: DateTime!
    sourceAccount: String!
    sourceAccountSequence: String!
    feeAccount: String
    feeCharged: Int!
    maxFee: Int!
    operationCount: Int!
    envelopeXdr: String!
    resultXdr: String!
    resultMetaXdr: String!
    feeMetaXdr: String!
    memoType: String
    memo: String
    signatures: [String!]!
    validAfter: DateTime
    validBefore: DateTime
    feeBumpTransaction: Boolean
    innerTransaction: Transaction
    operations: [Operation!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Operation {
    id: String!
    pagingToken: String!
    transactionHash: String!
    transactionSuccessful: Boolean!
    type: String!
    createdAt: DateTime!
    sourceAccount: String!
    transaction: Transaction!
    ledger: Int!
    operationIndex: Int!
    details: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Account {
    accountId: String!
    balance: String!
    assetType: String!
    assetCode: String
    assetIssuer: String
    buyingLiabilities: String!
    sellingLiabilities: String!
    lastModifiedLedger: Int!
    isAuthorized: Boolean!
    isAuthorizedToMaintainLiabilities: Boolean!
    isClawbackEnabled: Boolean!
    sequenceNumber: String!
    numSubentries: Int!
    thresholds: JSON!
    flags: JSON!
    signers: JSON!
    data: JSON!
    sponsor: String
    numSponsored: Int!
    numSponsoring: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Analytics types
  type NetworkMetrics {
    timestamp: DateTime!
    ledgerCount: Int!
    transactionCount: Int!
    operationCount: Int!
    activeAccounts: Int!
    totalVolume: String!
    averageFee: Float!
    successRate: Float!
  }

  type AssetMetrics {
    asset: Asset!
    volume24h: String!
    volume7d: String!
    volume30d: String!
    trades24h: Int!
    trades7d: Int!
    trades30d: Int!
    priceChange24h: Float!
    marketCap: String
    holders: Int!
  }

  type AccountMetrics {
    accountId: String!
    balanceNative: String!
    totalBalanceUsd: String!
    transactionCount24h: Int!
    transactionCount7d: Int!
    transactionCount30d: Int!
    firstTransaction: DateTime
    lastTransaction: DateTime!
    isActive: Boolean!
    trustlines: Int!
    signers: Int!
  }

  # Filter inputs
  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  input TimeRangeInput {
    startTime: DateTime
    endTime: DateTime
  }

  input AssetFilterInput {
    assetType: String
    assetCode: String
    assetIssuer: String
  }

  input AccountFilterInput {
    accountId: String
    minBalance: String
    maxBalance: String
    isActive: Boolean
  }

  input TransactionFilterInput {
    successful: Boolean
    minFee: Int
    maxFee: Int
    hasMemo: Boolean
    memoType: String
  }

  input OperationFilterInput {
    type: String
    successful: Boolean
    sourceAccount: String
  }

  # Queries
  type Query {
    # Ledger queries
    ledgers(
      pagination: PaginationInput
      timeRange: TimeRangeInput
    ): Connection<Ledger>!
    
    ledger(sequence: Int!): Ledger

    # Transaction queries
    transactions(
      pagination: PaginationInput
      timeRange: TimeRangeInput
      filter: TransactionFilterInput
    ): Connection<Transaction>!
    
    transaction(hash: String!): Transaction

    # Operation queries
    operations(
      pagination: PaginationInput
      timeRange: TimeRangeInput
      filter: OperationFilterInput
    ): Connection[Operation]!
    
    operation(id: String!): Operation

    # Account queries
    accounts(
      pagination: PaginationInput
      filter: AccountFilterInput
    ): Connection[Account]!
    
    account(accountId: String!): Account

    # Asset queries
    assets(
      pagination: PaginationInput
      filter: AssetFilterInput
    ): Connection[Asset]!
    
    asset(assetType: String!, assetCode: String, assetIssuer: String): Asset

    # Analytics queries
    networkMetrics(
      timeRange: TimeRangeInput
    ): [NetworkMetrics!]!
    
    assetMetrics(
      pagination: PaginationInput
      filter: AssetFilterInput
      timeRange: TimeRangeInput
    ): [AssetMetrics!]!
    
    accountMetrics(
      accountId: String!
      timeRange: TimeRangeInput
    ): [AccountMetrics!]!

    # Aggregation queries
    stats: NetworkStats!
  }

  type NetworkStats {
    totalLedgers: Int!
    totalTransactions: Int!
    totalOperations: Int!
    totalAccounts: Int!
    totalAssets: Int!
    activeAccounts24h: Int!
    activeAccounts7d: Int!
    activeAccounts30d: Int!
    volume24h: String!
    volume7d: String!
    volume30d: String!
    averageFee24h: Float!
    successRate24h: Float!
    latestLedger: Int!
    latestLedgerTime: DateTime!
  }

  # Mutations (if needed for future features)
  type Mutation {
    # Placeholder for future mutations
    _empty: String
  }

  # Subscriptions for real-time updates
  type Subscription {
    ledgerAdded: Ledger!
    transactionAdded: Transaction!
    operationAdded: Operation!
    networkMetricsUpdated: NetworkMetrics!
    
    # Filtered subscriptions
    transactionsForAccount(accountId: String!): Transaction!
    operationsForAccount(accountId: String!): Operation!
    operationsForType(type: String!): Operation!
  }
`;
