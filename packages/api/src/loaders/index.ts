import DataLoader from 'dataloader';
import { db } from '../database/connection';

// Ledger loaders
export const ledgerLoader = new DataLoader(async (sequences: readonly number[]) => {
  const ledgers = await db.query(
    `SELECT 
      id, sequence, successful_transaction_count, failed_transaction_count,
      operation_count, tx_set_operation_count, closed_at, total_coins,
      fee_pool, base_fee_in_stroops, base_reserve_in_stroops,
      max_tx_set_size, protocol_version, header_xdr, created_at, updated_at
    FROM ledgers WHERE sequence = ANY($1)`,
    [sequences]
  );

  return sequences.map(sequence => 
    ledgers.find(ledger => ledger.sequence === sequence) || null
  );
});

// Transaction loaders
export const transactionLoader = new DataLoader(async (hashes: readonly string[]) => {
  const transactions = await db.query(
    `SELECT 
      id, paging_token, successful, hash, ledger_sequence, created_at,
      source_account, source_account_sequence, fee_account, fee_charged,
      max_fee, operation_count, envelope_xdr, result_xdr, result_meta_xdr,
      fee_meta_xdr, memo_type, memo, signatures, valid_after, valid_before,
      fee_bump_transaction, inner_transaction_hash, inner_transaction_signatures
    FROM transactions WHERE hash = ANY($1)`,
    [hashes]
  );

  return hashes.map(hash => 
    transactions.find(tx => tx.hash === hash) || null
  );
});

// Operation loaders
export const operationLoader = new DataLoader(async (ids: readonly string[]) => {
  const operations = await db.query(
    `SELECT 
      id, paging_token, transaction_hash, transaction_successful,
      type, created_at, source_account, ledger_sequence, operation_index, details
    FROM operations WHERE id = ANY($1)`,
    [ids]
  );

  return ids.map(id => 
    operations.find(op => op.id === id) || null
  );
});

// Account loaders
export const accountLoader = new DataLoader(async (accountIds: readonly string[]) => {
  const accounts = await db.query(
    `SELECT 
      account_id, balance, asset_type, asset_code, asset_issuer,
      buying_liabilities, selling_liabilities, last_modified_ledger,
      is_authorized, is_authorized_to_maintain_liabilities,
      is_clawback_enabled, sequence_number, num_subentries,
      thresholds, flags, signers, data, sponsor, num_sponsored,
      num_sponsoring, created_at, updated_at
    FROM accounts WHERE account_id = ANY($1)`,
    [accountIds]
  );

  return accountIds.map(accountId => 
    accounts.find(account => account.account_id === accountId) || null
  );
});

// Asset loaders
export const assetLoader = new DataLoader(async (assetIds: readonly number[]) => {
  const assets = await db.query(
    `SELECT id, asset_type, asset_code, asset_issuer, native
    FROM assets WHERE id = ANY($1)`,
    [assetIds]
  );

  return assetIds.map(id => 
    assets.find(asset => asset.id === id) || null
  );
});

// Operations for transaction loader
export const transactionOperationsLoader = new DataLoader(async (transactionHashes: readonly string[]) => {
  const operations = await db.query(
    `SELECT 
      id, paging_token, transaction_hash, transaction_successful,
      type, created_at, source_account, ledger_sequence, operation_index, details
    FROM operations 
    WHERE transaction_hash = ANY($1)
    ORDER BY transaction_hash, operation_index`,
    [transactionHashes]
  );

  return transactionHashes.map(hash => 
    operations.filter(op => op.transaction_hash === hash)
  );
});

// Network metrics loader
export const networkMetricsLoader = new DataLoader(async (timestamps: readonly string[]) => {
  const metrics = await db.query(
    `SELECT 
      timestamp, ledger_count, transaction_count, operation_count,
      active_accounts, total_volume, average_fee, success_rate
    FROM network_metrics 
    WHERE timestamp = ANY($1)
    ORDER BY timestamp`,
    [timestamps]
  );

  return timestamps.map(timestamp => 
    metrics.find(metric => metric.timestamp === timestamp) || null
  );
});
