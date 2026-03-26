import { gql } from '@apollo/client';

export const STATS_QUERY = gql`
  query GetStats {
    stats {
      totalLedgers
      totalTransactions
      totalOperations
      totalAccounts
      totalAssets
      activeAccounts24h
      activeAccounts7d
      activeAccounts30d
      volume24h
      volume7d
      volume30d
      averageFee24h
      successRate24h
      latestLedger
      latestLedgerTime
    }
  }
`;

export const LEDGERS_QUERY = gql`
  query GetLedgers($first: Int, $after: String, $timeRange: TimeRangeInput) {
    ledgers(pagination: { first: $first, after: $after }, timeRange: $timeRange) {
      edges {
        cursor
        node {
          id
          sequence
          successfulTransactionCount
          failedTransactionCount
          operationCount
          txSetOperationCount
          closedAt
          totalCoins
          feePool
          baseFeeInStroops
          baseReserveInStroops
          maxTxSetSize
          protocolVersion
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const TRANSACTIONS_QUERY = gql`
  query GetTransactions(
    $first: Int
    $after: String
    $timeRange: TimeRangeInput
    $filter: TransactionFilterInput
  ) {
    transactions(
      pagination: { first: $first, after: $after }
      timeRange: $timeRange
      filter: $filter
    ) {
      edges {
        cursor
        node {
          id
          hash
          successful
          ledger
          createdAt
          sourceAccount
          feeCharged
          operationCount
          memoType
          memo
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const TRANSACTION_QUERY = gql`
  query GetTransaction($hash: String!) {
    transaction(hash: $hash) {
      id
      hash
      successful
      ledger
      createdAt
      sourceAccount
      sourceAccountSequence
      feeAccount
      feeCharged
      maxFee
      operationCount
      envelopeXdr
      resultXdr
      memoType
      memo
      signatures
      operations {
        id
        type
        sourceAccount
        createdAt
        details
      }
    }
  }
`;

export const OPERATIONS_QUERY = gql`
  query GetOperations(
    $first: Int
    $after: String
    $timeRange: TimeRangeInput
    $filter: OperationFilterInput
  ) {
    operations(
      pagination: { first: $first, after: $after }
      timeRange: $timeRange
      filter: $filter
    ) {
      edges {
        cursor
        node {
          id
          type
          transactionHash
          transactionSuccessful
          sourceAccount
          createdAt
          details
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const ACCOUNTS_QUERY = gql`
  query GetAccounts($first: Int, $after: String, $filter: AccountFilterInput) {
    accounts(pagination: { first: $first, after: $after }, filter: $filter) {
      edges {
        cursor
        node {
          accountId
          balance
          assetType
          lastModifiedLedger
          sequenceNumber
          numSubentries
          thresholds
          flags
          signers
          createdAt
          updatedAt
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const ACCOUNT_QUERY = gql`
  query GetAccount($accountId: String!) {
    account(accountId: $accountId) {
      accountId
      balance
      assetType
      assetCode
      assetIssuer
      buyingLiabilities
      sellingLiabilities
      lastModifiedLedger
      isAuthorized
      isAuthorizedToMaintainLiabilities
      isClawbackEnabled
      sequenceNumber
      numSubentries
      thresholds
      flags
      signers
      data
      sponsor
      numSponsored
      numSponsoring
      createdAt
      updatedAt
    }
  }
`;

export const ASSETS_QUERY = gql`
  query GetAssets($first: Int, $after: String, $filter: AssetFilterInput) {
    assets(pagination: { first: $first, after: $after }, filter: $filter) {
      edges {
        cursor
        node {
          assetType
          assetCode
          assetIssuer
          native
        }
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      totalCount
    }
  }
`;

export const NETWORK_METRICS_QUERY = gql`
  query GetNetworkMetrics($timeRange: TimeRangeInput) {
    networkMetrics(timeRange: $timeRange) {
      timestamp
      ledgerCount
      transactionCount
      operationCount
      activeAccounts
      totalVolume
      averageFee
      successRate
    }
  }
`;

export const ASSET_METRICS_QUERY = gql`
  query GetAssetMetrics($first: Int, $filter: AssetFilterInput, $timeRange: TimeRangeInput) {
    assetMetrics(pagination: { first: $first }, filter: $filter, timeRange: $timeRange) {
      asset {
        assetType
        assetCode
        assetIssuer
        native
      }
      volume24h
      volume7d
      volume30d
      trades24h
      trades7d
      trades30d
      priceChange24h
      marketCap
      holders
    }
  }
`;

export const ACCOUNT_METRICS_QUERY = gql`
  query GetAccountMetrics($accountId: String!, $timeRange: TimeRangeInput) {
    accountMetrics(accountId: $accountId, timeRange: $timeRange) {
      accountId
      balanceNative
      totalBalanceUsd
      transactionCount24h
      transactionCount7d
      transactionCount30d
      firstTransaction
      lastTransaction
      isActive
      trustlines
      signers
    }
  }
`;

export const NEW_LEDGER_SUBSCRIPTION = gql`
  subscription OnNewLedger {
    ledgerAdded {
      sequence
      closedAt
      operationCount
      successfulTransactionCount
    }
  }
`;
