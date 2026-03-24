import type { Pool } from "pg";
import type { NormalizedLedger } from "./transformer.js";

export async function writeLedgers(pool: Pool | null, ledgers: NormalizedLedger[]): Promise<void> {
  if (!pool) {
    console.log(`[loader] No DATABASE_URL set, skipping ${ledgers.length} ledger writes.`);
    return;
  }

  for (const ledger of ledgers) {
    await pool.query(
      `INSERT INTO ledgers (ledger_sequence, ledger_hash, closed_at, tx_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ledger_sequence) DO UPDATE SET
         ledger_hash = EXCLUDED.ledger_hash,
         closed_at = EXCLUDED.closed_at,
         tx_count = EXCLUDED.tx_count`,
      [ledger.sequence, ledger.hash, ledger.closedAt, ledger.txCount]
    );
  }
}
