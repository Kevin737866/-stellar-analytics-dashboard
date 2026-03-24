import type { IngestedLedger } from "./ingester.js";

export interface NormalizedLedger {
  sequence: number;
  hash: string;
  closedAt: Date;
  txCount: number;
}

export function normalizeLedgers(input: IngestedLedger[]): NormalizedLedger[] {
  return input.map((ledger) => ({
    sequence: ledger.sequence,
    hash: ledger.hash,
    closedAt: new Date(ledger.closedAt),
    txCount: ledger.txCount
  }));
}
