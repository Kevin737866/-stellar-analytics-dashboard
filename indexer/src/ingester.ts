import { STELLAR_NETWORKS, type StellarNetwork } from "@stellar-analytics/shared";

export interface IngestedLedger {
  sequence: number;
  hash: string;
  closedAt: string;
  txCount: number;
}

export async function pollHorizon(network: StellarNetwork): Promise<IngestedLedger[]> {
  const config = STELLAR_NETWORKS[network];
  const now = new Date().toISOString();

  // Stubbed polling output for pipeline wiring.
  return [
    {
      sequence: Math.floor(Date.now() / 1000),
      hash: `stub-${network}-${Date.now()}`,
      closedAt: now,
      txCount: 0
    }
  ].map((ledger) => ({ ...ledger, hash: `${ledger.hash}@${config.horizonUrl}` }));
}
