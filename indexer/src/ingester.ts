import { Horizon } from "@stellar/stellar-sdk";
import { STELLAR_NETWORKS, type StellarNetwork } from "@stellar-analytics/shared";

export interface IngestedData {
  ledger: Horizon.ServerApi.LedgerRecord;
  transactions: Horizon.ServerApi.TransactionRecord[];
  operations: Horizon.ServerApi.OperationRecord[];
}

export async function pollLatestLedger(network: StellarNetwork): Promise<IngestedData> {
  const config = STELLAR_NETWORKS[network];
  const server = new Horizon.Server(config.horizonUrl);

  try {
    // 1. Get latest ledger
    const ledgers = await server.ledgers().order("desc").limit(1).call();
    const latestLedger = ledgers.records[0];

    if (!latestLedger) {
      throw new Error("No ledgers found on Horizon");
    }

    // 2. Get transactions for this ledger
    const transactions = await server.transactions().forLedger(latestLedger.sequence).call();
    
    // 3. Get operations for this ledger (can be many across all txs)
    const operations = await server.operations().forLedger(latestLedger.sequence).call();

    return {
      ledger: latestLedger,
      transactions: transactions.records,
      operations: operations.records,
    };
  } catch (error) {
    console.error(`[ingester] failed to poll Horizon (${network}):`, error);
    throw error;
  }
}

/**
 * Backfill helper: Fetch specific ledger range
 */
export async function fetchLedgerRange(network: StellarNetwork, start: number, end: number): Promise<IngestedData[]> {
  const config = STELLAR_NETWORKS[network];
  const server = new Horizon.Server(config.horizonUrl);
  const results: IngestedData[] = [];

  for (let seq = start; seq <= end; seq++) {
    const ledgerResp = await server.ledgers().ledger(seq).call() as any;
    const ledger = ledgerResp.records ? ledgerResp.records[0] : ledgerResp;
    
    const transactions = await server.transactions().forLedger(seq).call();
    const operations = await server.operations().forLedger(seq).call();
    
    results.push({
      ledger,
      transactions: transactions.records,
      operations: operations.records,
    });
  }

  return results;
}
