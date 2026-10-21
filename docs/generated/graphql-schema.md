# GraphQL Schema Reference

> Generated from `api/src/schema.ts` by `pnpm docs:graphql`. Do not edit by hand.

## Account

| Field                      | Type              | Description |
| -------------------------- | ----------------- | ----------- |
| `address`                  | `String!`         |             |
| `transactions(limit: Int)` | `[Transaction!]!` |             |
| `operations(limit: Int)`   | `[Operation!]!`   |             |

## AccountStats

| Field                | Type      | Description |
| -------------------- | --------- | ----------- |
| `address`            | `String!` |             |
| `transactionCount`   | `Int!`    |             |
| `totalPaymentVolume` | `String!` |             |
| `lastActive`         | `String!` |             |

## AssetVolume

| Field       | Type      | Description |
| ----------- | --------- | ----------- |
| `assetCode` | `String!` |             |
| `volume`    | `String!` |             |
| `timeframe` | `String!` |             |

## DailyCount

| Field   | Type      | Description |
| ------- | --------- | ----------- |
| `date`  | `String!` |             |
| `count` | `Int!`    |             |

## DataFreshness

| Field                     | Type      | Description |
| ------------------------- | --------- | ----------- |
| `ledgersLastUpdated`      | `String!` |             |
| `transactionsLastUpdated` | `String!` |             |
| `operationsLastUpdated`   | `String!` |             |
| `dashboardLastUpdated`    | `String!` |             |

## Health

| Field       | Type      | Description |
| ----------- | --------- | ----------- |
| `status`    | `String!` |             |
| `timestamp` | `String!` |             |

## Ledger

| Field              | Type              | Description |
| ------------------ | ----------------- | ----------- |
| `sequence`         | `Int!`            |             |
| `hash`             | `String!`         |             |
| `closeTime`        | `String!`         |             |
| `transactionCount` | `Int!`            |             |
| `operations`       | `[Operation!]!`   |             |
| `transactions`     | `[Transaction!]!` |             |

## LedgerAddedEvent

| Field              | Type      | Description |
| ------------------ | --------- | ----------- |
| `sequence`         | `Int!`    |             |
| `transactionCount` | `Int!`    |             |
| `closeTime`        | `String!` |             |

## LedgerConnection

| Field      | Type             | Description |
| ---------- | ---------------- | ----------- |
| `edges`    | `[LedgerEdge!]!` |             |
| `pageInfo` | `PageInfo!`      |             |

## LedgerEdge

| Field    | Type      | Description |
| -------- | --------- | ----------- |
| `node`   | `Ledger!` |             |
| `cursor` | `String!` |             |

## NetworkStats

| Field               | Type     | Description |
| ------------------- | -------- | ----------- |
| `tps`               | `Float!` |             |
| `totalAccounts`     | `Int!`   |             |
| `activeAccounts24h` | `Int!`   |             |
| `totalLedgers`      | `Int!`   |             |

## Operation

| Field           | Type      | Description |
| --------------- | --------- | ----------- |
| `id`            | `String!` |             |
| `txHash`        | `String!` |             |
| `type`          | `String!` |             |
| `sourceAccount` | `String!` |             |
| `createdAt`     | `String!` |             |

## PageInfo

| Field         | Type       | Description |
| ------------- | ---------- | ----------- |
| `hasNextPage` | `Boolean!` |             |
| `endCursor`   | `String`   |             |

## Query

| Field                                                                | Type                 | Description |
| -------------------------------------------------------------------- | -------------------- | ----------- |
| `health`                                                             | `Health!`            |             |
| `ledger(sequence: Int!)`                                             | `Ledger`             |             |
| `ledgers(limit: Int, cursor: String)`                                | `LedgerConnection!`  |             |
| `transactions(address: String, addresses: [String!], limit: Int)`    | `[Transaction!]!`    |             |
| `operations(type: String, limit: Int)`                               | `[Operation!]!`      |             |
| `accountStats(address: String!)`                                     | `AccountStats!`      |             |
| `networkStats`                                                       | `NetworkStats!`      |             |
| `stats`                                                              | `Stats!`             |             |
| `networkMetrics(timeRange: TimeRangeInput, preset: TimeRangePreset)` | `[NetworkMetrics!]!` |             |
| `assetVolume(assetCode: String!, timeframe: String!)`                | `AssetVolume!`       |             |
| `topAccounts(limit: Int)`                                            | `[TopAccount!]!`     |             |
| `dailyTransactionCount(days: Int)`                                   | `[DailyCount!]!`     |             |
| `dataFreshness`                                                      | `DataFreshness!`     |             |

## Subscription

| Field         | Type                | Description |
| ------------- | ------------------- | ----------- |
| `ledgerAdded` | `LedgerAddedEvent!` |             |

## TimeRangeInput

| Field       | Type     | Description |
| ----------- | -------- | ----------- |
| `startTime` | `String` |             |
| `endTime`   | `String` |             |

## TimeRangePreset

- `LAST_HOUR`
- `LAST_DAY`
- `LAST_WEEK`
- `LAST_MONTH`

## TopAccount

| Field     | Type      | Description |
| --------- | --------- | ----------- |
| `address` | `String!` |             |
| `balance` | `String!` |             |

## Transaction

| Field            | Type            | Description |
| ---------------- | --------------- | ----------- |
| `hash`           | `String!`       |             |
| `ledgerSequence` | `Int!`          |             |
| `sourceAccount`  | `String!`       |             |
| `feeCharged`     | `String!`       |             |
| `operations`     | `[Operation!]!` |             |
