export const typeDefs = /* GraphQL */ `
  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type Ledger {
    sequence: Int!
    hash: String!
    closeTime: String!
    transactionCount: Int!
    operations: [Operation!]!
    transactions: [Transaction!]!
  }

  type LedgerEdge {
    node: Ledger!
    cursor: String!
  }

  type LedgerConnection {
    edges: [LedgerEdge!]!
    pageInfo: PageInfo!
  }

  type Transaction {
    hash: String!
    ledgerSequence: Int!
    sourceAccount: String!
    feeCharged: String!
    operations: [Operation!]!
  }

  type Operation {
    id: String!
    txHash: String!
    type: String!
    sourceAccount: String!
    createdAt: String!
  }

  type Account {
    address: String!
    transactions(limit: Int): [Transaction!]!
    operations(limit: Int): [Operation!]!
  }

  type AccountStats {
    address: String!
    transactionCount: Int!
    totalPaymentVolume: String!
    lastActive: String!
  }

  type NetworkStats {
    tps: Float!
    totalAccounts: Int!
    activeAccounts24h: Int!
    totalLedgers: Int!
  }

  type AssetVolume {
    assetCode: String!
    volume: String!
    timeframe: String!
  }

  type TopAccount {
    address: String!
    balance: String!
  }

  type Query {
    health: Health!
    
    # Core Queries
    ledger(sequence: Int!): Ledger
    ledgers(limit: Int, cursor: String): LedgerConnection!
    transactions(address: String, limit: Int): [Transaction!]!
    operations(type: String, limit: Int): [Operation!]!
    
    # Analytics
    accountStats(address: String!): AccountStats!
    networkStats: NetworkStats!
    assetVolume(assetCode: String!, timeframe: String!): AssetVolume!
    topAccounts(limit: Int): [TopAccount!]!
    
    # Aggregation helpers
    dailyTransactionCount(days: Int): [DailyCount!]!
  }

  type DailyCount {
    date: String!
    count: Int!
  }

  type Health {
    status: String!
    timestamp: String!
  }
`;
