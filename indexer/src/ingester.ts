import { Horizon } from '@stellar/stellar-sdk';
import { STELLAR_NETWORKS, type StellarNetwork } from '@stellar-analytics/shared';
import { ingesterLogger } from './logger.js';
import {
  ledgers_processed_total,
  transactions_processed_total,
  operations_processed_total,
  ingestion_duration_seconds,
} from './metrics.js';

export interface IngestedData {
  ledger: Horizon.ServerApi.LedgerRecord;
  transactions: Horizon.ServerApi.TransactionRecord[];
  operations: Horizon.ServerApi.OperationRecord[];
}

/**
 * A minimal interface covering only the Horizon.Server methods used by
 * this module.  Accepting this interface instead of the concrete class lets
 * tests inject a mock without monkey-patching the SDK.
 */
export interface HorizonServerLike {
  ledgers(): {
    order(dir: string): { limit(n: number): { call(): Promise<{ records: any[] }> } };
    ledger(seq: number): { call(): Promise<{ records?: any[]; sequence?: number }> };
  };
  transactions(): {
    forLedger(seq: number): {
      limit(n: number): { call(): Promise<{ records: any[] }> };
      call(): Promise<{ records: any[] }>;
    };
  };
  operations(): {
    forLedger(seq: number): {
      limit(n: number): { call(): Promise<{ records: any[] }> };
      call(): Promise<{ records: any[] }>;
    };
  };
}

/**
 * Resolve the server to use:
 *  - If `serverOverride` is provided (e.g. in tests), use it directly.
 *  - If `STELLAR_MOCK=true` env var is set, use the built-in mock server.
 *  - Otherwise create a real Horizon.Server for the given network.
 */
export async function resolveServer(
  network: StellarNetwork,
  serverOverride?: HorizonServerLike
): Promise<HorizonServerLike> {
  if (serverOverride) return serverOverride;

  if (process.env.STELLAR_MOCK === "true") {
    // Lazy import so the mock module is never loaded in production bundles
    const { getMockHorizonServer } = await import("./mock-horizon.js");
    return getMockHorizonServer() as unknown as HorizonServerLike;
  }

  const config = STELLAR_NETWORKS[network];
  return new Horizon.Server(config.horizonUrl) as unknown as HorizonServerLike;
}

export async function pollLatestLedger(
  network: StellarNetwork,
  serverOverride?: HorizonServerLike
): Promise<IngestedData> {
  const server = await resolveServer(network, serverOverride);

  try {
    ingesterLogger.debug({ network }, 'Polling Horizon for latest ledger');

    // 1. Get latest ledger
    const ledgers = await server.ledgers().order('desc').limit(1).call();
    const latestLedger = ledgers.records[0];

    if (!latestLedger) {
      throw new Error('No ledgers found on Horizon');
    }

    // 2. Get transactions for this ledger
    const transactions = await server.transactions().forLedger(latestLedger.sequence).call();

    // 3. Get operations for this ledger (can be many across all txs)
    const operations = await server.operations().forLedger(latestLedger.sequence).call();

    ledgers_processed_total.inc();
    transactions_processed_total.inc(transactions.records.length);
    operations_processed_total.inc(operations.records.length);

    ingesterLogger.debug(
      {
        network,
        sequence: latestLedger.sequence,
        txCount: transactions.records.length,
        opCount: operations.records.length,
      },
      'Polled latest ledger'
    );

    return {
      ledger: latestLedger,
      transactions: transactions.records,
      operations: operations.records,
    };
  } catch (error: any) {
    ingesterLogger.error(
      { network, error: error?.message ?? String(error) },
      'Failed to poll Horizon'
    );
    throw error;
  } finally {
    end();
  }
}

/**
 * Backfill helper: Fetch a specific ledger by sequence number.
 * Used by the backfill module to fetch individual ledgers in parallel.
 */
export async function fetchLedger(
  network: StellarNetwork,
  sequence: number,
  serverOverride?: HorizonServerLike
): Promise<IngestedData> {
  const server = await resolveServer(network, serverOverride);

  const ledgerResp = await (server.ledgers().ledger(sequence) as any).call();
  const ledger: Horizon.ServerApi.LedgerRecord = ledgerResp.records
    ? ledgerResp.records[0]
    : ledgerResp;

  const [txResp, opResp] = await Promise.all([
    server.transactions().forLedger(sequence).limit(200).call(),
    server.operations().forLedger(sequence).limit(200).call(),
  ]);

  return {
    ledger,
    transactions: txResp.records,
    operations: opResp.records,
  };
}

/**
 * Backfill helper: Fetch a range of ledgers sequentially.
 * For parallel fetching, use the backfill module's `runBackfill` instead.
 */
export async function fetchLedgerRange(
  network: StellarNetwork,
  start: number,
  end: number,
  serverOverride?: HorizonServerLike
): Promise<IngestedData[]> {
  const results: IngestedData[] = [];
  for (let seq = start; seq <= end; seq++) {
    results.push(await fetchLedger(network, seq, serverOverride));
  }
  return results;
}
