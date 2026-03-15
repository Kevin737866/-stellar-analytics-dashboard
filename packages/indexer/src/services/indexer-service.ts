import { StellarService } from './stellar-service';
import { db } from '../database/connection';
import { INDEXER, PAYMENT_OPERATIONS, DEX_OPERATIONS } from '@stellar-analytics/shared';
import { Horizon } from '@stellar/stellar-sdk';

export class IndexerService {
  private stellarService: StellarService;
  private isRunning: boolean = false;
  private lastProcessedLedger: number = 0;

  constructor(stellarService: StellarService) {
    this.stellarService = stellarService;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Indexer is already running');
      return;
    }

    console.log('Starting Stellar indexer...');
    this.isRunning = true;

    try {
      await this.initializeLastProcessedLedger();
      await this.startRealtimeStreaming();
      await this.startBackfill();
    } catch (error) {
      console.error('Error starting indexer:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    console.log('Stopping Stellar indexer...');
    this.isRunning = false;
  }

  private async initializeLastProcessedLedger(): Promise<void> {
    const latestLedger = await db.queryOne<{ sequence: number }>(
      'SELECT sequence FROM ledgers ORDER BY sequence DESC LIMIT 1'
    );

    if (latestLedger) {
      this.lastProcessedLedger = latestLedger.sequence;
      console.log(`Resuming from ledger ${this.lastProcessedLedger}`);
    } else {
      const horizonLatest = await this.stellarService.getLatestLedger();
      this.lastProcessedLedger = horizonLatest.sequence - 1; // Start from previous ledger
      console.log(`Starting from ledger ${this.lastProcessedLedger}`);
    }
  }

  private async startRealtimeStreaming(): Promise<void> {
    console.log('Starting real-time ledger streaming...');
    
    this.stellarService.streamLedgers(
      async (ledger) => {
        if (ledger.sequence > this.lastProcessedLedger) {
          await this.processLedger(ledger);
          this.lastProcessedLedger = ledger.sequence;
        }
      },
      (error) => {
        console.error('Ledger stream error:', error);
        setTimeout(() => {
          if (this.isRunning) {
            this.startRealtimeStreaming();
          }
        }, INDEXER.WEBSOCKET_RECONNECT_DELAY);
      }
    );
  }

  private async startBackfill(): Promise<void> {
    console.log('Starting historical data backfill...');
    
    const horizonLatest = await this.stellarService.getLatestLedger();
    
    if (this.lastProcessedLedger < horizonLatest.sequence - 10) {
      // Only backfill if we're more than 10 ledgers behind
      await this.backfillLedgers(this.lastProcessedLedger + 1, horizonLatest.sequence - 10);
    }
  }

  private async backfillLedgers(startSequence: number, endSequence: number): Promise<void> {
    console.log(`Backfilling ledgers ${startSequence} to ${endSequence}`);
    
    for (let sequence = startSequence; sequence <= endSequence; sequence += INDEXER.BACKFILL_BATCH_SIZE) {
      if (!this.isRunning) break;

      const batchEnd = Math.min(sequence + INDEXER.BACKFILL_BATCH_SIZE - 1, endSequence);
      
      try {
        await this.processLedgerBatch(sequence, batchEnd);
        console.log(`Backfilled ledgers ${sequence} to ${batchEnd}`);
      } catch (error) {
        console.error(`Error backfilling ledgers ${sequence} to ${batchEnd}:`, error);
      }
    }
  }

  private async processLedgerBatch(startSequence: number, endSequence: number): Promise<void> {
    const ledgers: Horizon.ServerApi.LedgerRecord[] = [];
    
    for (let sequence = startSequence; sequence <= endSequence; sequence++) {
      try {
        const ledger = await this.stellarService.getLedger(sequence);
        ledgers.push(ledger);
      } catch (error) {
        console.error(`Error fetching ledger ${sequence}:`, error);
      }
    }

    // Process ledgers in parallel
    await Promise.all(ledgers.map(ledger => this.processLedger(ledger)));
  }

  private async processLedger(ledger: Horizon.ServerApi.LedgerRecord): Promise<void> {
    try {
      await db.transaction(async (client) => {
        // Insert ledger
        await client.query(`
          INSERT INTO ledgers (
            id, sequence, successful_transaction_count, failed_transaction_count,
            operation_count, tx_set_operation_count, closed_at, total_coins,
            fee_pool, base_fee_in_stroops, base_reserve_in_stroops,
            max_tx_set_size, protocol_version, header_xdr
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (sequence) DO UPDATE SET
            successful_transaction_count = EXCLUDED.successful_transaction_count,
            failed_transaction_count = EXCLUDED.failed_transaction_count,
            operation_count = EXCLUDED.operation_count,
            tx_set_operation_count = EXCLUDED.tx_set_operation_count,
            updated_at = NOW()
        `, [
          ledger.id,
          ledger.sequence,
          ledger.successful_transaction_count,
          ledger.failed_transaction_count,
          ledger.operation_count,
          ledger.tx_set_operation_count,
          ledger.closed_at,
          ledger.total_coins,
          ledger.fee_pool,
          ledger.base_fee_in_stroops,
          ledger.base_reserve_in_stroops,
          ledger.max_tx_set_size,
          ledger.protocol_version,
          ledger.header_xdr
        ]);

        // Process transactions
        await this.processTransactionsForLedger(ledger.sequence, client);
      });

      // Update metrics after successful processing
      await this.updateNetworkMetrics(ledger);
      
    } catch (error) {
      console.error(`Error processing ledger ${ledger.sequence}:`, error);
      throw error;
    }
  }

  private async processTransactionsForLedger(ledgerSequence: number, client: any): Promise<void> {
    const transactions = await this.stellarService.getTransactionsForLedger(ledgerSequence);
    
    for (const txRecord of transactions.records) {
      await this.processTransaction(txRecord, client);
    }
  }

  private async processTransaction(txRecord: Horizon.ServerApi.TransactionRecord, client: any): Promise<void> {
    // Insert transaction
    await client.query(`
      INSERT INTO transactions (
        id, paging_token, successful, hash, ledger_sequence, created_at,
        source_account, source_account_sequence, fee_account, fee_charged,
        max_fee, operation_count, envelope_xdr, result_xdr, result_meta_xdr,
        fee_meta_xdr, memo_type, memo, signatures, valid_after, valid_before,
        fee_bump_transaction, inner_transaction_hash, inner_transaction_signatures
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (hash) DO UPDATE SET
        successful = EXCLUDED.successful,
        updated_at = NOW()
    `, [
      txRecord.id,
      txRecord.paging_token,
      txRecord.successful,
      txRecord.hash,
      txRecord.ledger,
      txRecord.created_at,
      txRecord.source_account,
      txRecord.source_account_sequence,
      txRecord.fee_account,
      txRecord.fee_charged,
      txRecord.max_fee,
      txRecord.operation_count,
      txRecord.envelope_xdr,
      txRecord.result_xdr,
      txRecord.result_meta_xdr,
      txRecord.fee_meta_xdr,
      txRecord.memo_type || 'none',
      txRecord.memo,
      JSON.stringify(txRecord.signatures),
      txRecord.valid_after,
      txRecord.valid_before,
      txRecord.fee_bump_transaction,
      txRecord.inner_transaction?.hash,
      txRecord.inner_transaction ? JSON.stringify(txRecord.inner_transaction.signatures) : null
    ]);

    // Process operations
    await this.processOperationsForTransaction(txRecord.hash, client);
  }

  private async processOperationsForTransaction(transactionHash: string, client: any): Promise<void> {
    const operations = await this.stellarService.getOperationsForTransaction(transactionHash);
    
    for (const opRecord of operations.records) {
      await this.processOperation(opRecord, client);
    }
  }

  private async processOperation(opRecord: Horizon.ServerApi.OperationRecord, client: any): Promise<void> {
    const details = this.extractOperationDetails(opRecord);
    
    await client.query(`
      INSERT INTO operations (
        id, paging_token, transaction_hash, transaction_successful,
        type, created_at, source_account, ledger_sequence, operation_index, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET
        transaction_successful = EXCLUDED.transaction_successful,
        details = EXCLUDED.details,
        updated_at = NOW()
    `, [
      opRecord.id,
      opRecord.paging_token,
      opRecord.transaction_hash,
      opRecord.transaction_successful,
      opRecord.type,
      opRecord.created_at,
      opRecord.source_account,
      opRecord.id.split('-')[0], // Extract ledger sequence from operation ID
      parseInt(opRecord.id.split('-')[1]), // Extract operation index
      JSON.stringify(details)
    ]);
  }

  private extractOperationDetails(operation: Horizon.ServerApi.OperationRecord): any {
    const baseDetails = {
      type: operation.type,
      source_account: operation.source_account,
    };

    switch (operation.type) {
      case 'payment':
        return {
          ...baseDetails,
          asset_type: operation.asset_type,
          asset_code: operation.asset_code,
          asset_issuer: operation.asset_issuer,
          from: operation.from,
          to: operation.to,
          amount: operation.amount,
        };

      case 'create_account':
        return {
          ...baseDetails,
          account: operation.account,
          starting_balance: operation.starting_balance,
          funder: operation.funder,
        };

      case 'manage_sell_offer':
        return {
          ...baseDetails,
          selling_asset: operation.selling_asset,
          buying_asset: operation.buying_asset,
          amount: operation.amount,
          price: operation.price,
          offer_id: operation.offer_id,
        };

      case 'path_payment_strict_receive':
        return {
          ...baseDetails,
          from: operation.from,
          to: operation.to,
          amount: operation.amount,
          source_amount: operation.source_amount,
          source_max: operation.source_max,
          destination_asset: operation.destination_asset,
          destination_min: operation.destination_min,
          path: operation.path,
        };

      case 'change_trust':
        return {
          ...baseDetails,
          asset_type: operation.asset_type,
          asset_code: operation.asset_code,
          asset_issuer: operation.asset_issuer,
          trustor: operation.trustor,
          trustee: operation.trustee,
          limit: operation.limit,
        };

      default:
        return baseDetails;
    }
  }

  private async updateNetworkMetrics(ledger: Horizon.ServerApi.LedgerRecord): Promise<void> {
    const timestamp = new Date(ledger.closed_at);
    
    // Calculate metrics for the time window
    const metrics = await this.calculateNetworkMetrics(timestamp);
    
    await db.query(`
      INSERT INTO network_metrics (
        timestamp, ledger_count, transaction_count, operation_count,
        active_accounts, total_volume, average_fee, success_rate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      timestamp,
      metrics.ledgerCount,
      metrics.transactionCount,
      metrics.operationCount,
      metrics.activeAccounts,
      metrics.totalVolume,
      metrics.averageFee,
      metrics.successRate
    ]);
  }

  private async calculateNetworkMetrics(timestamp: Date): Promise<any> {
    const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);
    
    const [txMetrics, opMetrics, accountMetrics] = await Promise.all([
      db.queryOne(`
        SELECT 
          COUNT(*) as transaction_count,
          COUNT(CASE WHEN successful THEN 1 END) as successful_count,
          AVG(fee_charged) as average_fee
        FROM transactions 
        WHERE created_at >= $1 AND created_at <= $2
      `, [oneHourAgo, timestamp]),
      
      db.queryOne(`
        SELECT COUNT(*) as operation_count
        FROM operations 
        WHERE created_at >= $1 AND created_at <= $2
      `, [oneHourAgo, timestamp]),
      
      db.queryOne(`
        SELECT COUNT(DISTINCT source_account) as active_accounts
        FROM transactions 
        WHERE created_at >= $1 AND created_at <= $2
      `, [oneHourAgo, timestamp])
    ]);

    const successRate = txMetrics.transaction_count > 0 
      ? (txMetrics.successful_count / txMetrics.transaction_count) * 100 
      : 0;

    // Calculate total volume from payment operations
    const volumeResult = await db.queryOne(`
      SELECT SUM(CAST(details->>'amount' AS NUMERIC)) as total_volume
      FROM operations 
      WHERE type = 'payment' 
      AND created_at >= $1 AND created_at <= $2
    `, [oneHourAgo, timestamp]);

    return {
      ledgerCount: 1,
      transactionCount: parseInt(txMetrics.transaction_count),
      operationCount: parseInt(opMetrics.operation_count),
      activeAccounts: parseInt(accountMetrics.active_accounts),
      totalVolume: volumeResult.total_volume || '0',
      averageFee: parseFloat(txMetrics.average_fee) || 0,
      successRate: parseFloat(successRate.toFixed(2))
    };
  }

  async getStatus(): Promise<any> {
    return {
      isRunning: this.isRunning,
      lastProcessedLedger: this.lastProcessedLedger,
      horizonUrl: this.stellarService.getHorizonUrl(),
    };
  }
}
