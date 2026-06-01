import { Horizon, Server } from '@stellar/stellar-sdk';
import { Ledger, Transaction, Operation } from '@stellar-analytics/shared';

export class StellarService {
  private server: Server;
  private horizonUrl: string;
  private readonly retryAttempts = 5;
  private readonly retryInitialDelayMs = 300;

  constructor(horizonUrl: string) {
    this.horizonUrl = horizonUrl;
    this.server = new Server(horizonUrl);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let delay = this.retryInitialDelayMs;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        if (attempt >= this.retryAttempts) {
          throw err;
        }
        // exponential backoff with jitter
        const jitter = Math.random() * 0.5 + 0.75; // 0.75 - 1.25
        const waitMs = Math.round(delay * jitter);
        // increase delay for next attempt (cap to 10s)
        delay = Math.min(10000, delay * 2);
        console.warn(`Horizon request failed (attempt ${attempt}). Retrying in ${waitMs}ms...`, err);
        await this.sleep(waitMs);
      }
    }
  }

  async getLatestLedger(): Promise<Horizon.ServerApi.LedgerRecord> {
    const builder = this.server.ledgers().order('desc').limit(1);
    return this.withRetry(() => builder.call());
  }

  async getLedgers(cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.LedgerRecord>> {
    let builder = this.server.ledgers().order('desc').limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  async getLedger(sequence: number): Promise<Horizon.ServerApi.LedgerRecord> {
    const builder = this.server.ledgers().ledger(sequence);
    return this.withRetry(() => builder.call());
  }

  async getTransactionsForLedger(ledgerSequence: number): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.TransactionRecord>> {
    const builder = this.server.transactions()
      .forLedger(ledgerSequence)
      .order('asc')
      .limit(200);
    return this.withRetry(() => builder.call());
  }

  async getTransactions(cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.TransactionRecord>> {
    let builder = this.server.transactions().order('desc').limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  async getTransaction(hash: string): Promise<Horizon.ServerApi.TransactionRecord> {
    const builder = this.server.transactions().transaction(hash);
    return this.withRetry(() => builder.call());
  }

  async getOperationsForTransaction(transactionHash: string): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.OperationRecord>> {
    const builder = this.server.operations()
      .forTransaction(transactionHash)
      .order('asc')
      .limit(100);
    return this.withRetry(() => builder.call());
  }

  async getOperations(cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.OperationRecord>> {
    let builder = this.server.operations().order('desc').limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  async getOperationsForLedger(ledgerSequence: number): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.OperationRecord>> {
    const builder = this.server.operations()
      .forLedger(ledgerSequence)
      .order('asc')
      .limit(1000);
    return this.withRetry(() => builder.call());
  }

  async getAccount(accountId: string): Promise<Horizon.ServerApi.AccountRecord> {
    const builder = this.server.accounts().accountId(accountId);
    return this.withRetry(() => builder.call());
  }

  async getAccountTransactions(accountId: string, cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.TransactionRecord>> {
    let builder = this.server.transactions()
      .forAccount(accountId)
      .order('desc')
      .limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  async getAccountOperations(accountId: string, cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.OperationRecord>> {
    let builder = this.server.operations()
      .forAccount(accountId)
      .order('desc')
      .limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  async getAssets(cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.AssetRecord>> {
    let builder = this.server.assets().order('asc').limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  async getTrades(cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.TradeRecord>> {
    let builder = this.server.trades().order('desc').limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  async getEffects(cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.EffectRecord>> {
    let builder = this.server.effects().order('desc').limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  async getPayments(cursor?: string, limit: number = 200): Promise<Horizon.ServerApi.CollectionPage<Horizon.ServerApi.PaymentOperationRecord>> {
    let builder = this.server.payments().order('desc').limit(limit);
    if (cursor) {
      builder = builder.cursor(cursor);
    }
    return this.withRetry(() => builder.call());
  }

  // Stream real-time data
  streamLedgers(onMessage: (ledger: Horizon.ServerApi.LedgerRecord) => void, onError?: (error: Error) => void): void {
    const ledgerStream = this.server.ledgers()
      .cursor('now')
      .stream({
        onmessage: onMessage,
        onerror: onError || ((error) => console.error('Ledger stream error:', error)),
      });
  }

  streamTransactions(onMessage: (transaction: Horizon.ServerApi.TransactionRecord) => void, onError?: (error: Error) => void): void {
    const txStream = this.server.transactions()
      .cursor('now')
      .stream({
        onmessage: onMessage,
        onerror: onError || ((error) => console.error('Transaction stream error:', error)),
      });
  }

  streamOperations(onMessage: (operation: Horizon.ServerApi.OperationRecord) => void, onError?: (error: Error) => void): void {
    const opStream = this.server.operations()
      .cursor('now')
      .stream({
        onmessage: onMessage,
        onerror: onError || ((error) => console.error('Operation stream error:', error)),
      });
  }

  streamPayments(onMessage: (payment: Horizon.ServerApi.PaymentOperationRecord) => void, onError?: (error: Error) => void): void {
    const paymentStream = this.server.payments()
      .cursor('now')
      .stream({
        onmessage: onMessage,
        onerror: onError || ((error) => console.error('Payment stream error:', error)),
      });
  }

  // Utility methods
  getServer(): Server {
    return this.server;
  }

  getHorizonUrl(): string {
    return this.horizonUrl;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.withRetry(() => this.server.root().call());
      return true;
    } catch (error) {
      console.error('Failed to connect to Horizon:', error);
      return false;
    }
  }
}
