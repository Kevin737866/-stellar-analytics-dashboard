import type { Pool } from "pg";

export async function writeIngestedData(pool: Pool | null, data: any) {
  if (!pool) {
    console.warn("[loader] database pool not configured, skipping write");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Write ledger
    const ledger = data.ledger;
    await client.query(
      "INSERT INTO ledgers (sequence, hash, closed_at, tx_count) VALUES ($1, $2, $3, $4) ON CONFLICT (sequence) DO NOTHING",
      [ledger.sequence, ledger.hash, ledger.close_time, ledger.tx_count]
    );

    // 2. Write transactions
    for (const tx of data.transactions) {
      await client.query(
        "INSERT INTO transactions (hash, ledger_sequence, source_account, fee_charged) VALUES ($1, $2, $3, $4) ON CONFLICT (hash) DO NOTHING",
        [tx.hash, tx.ledger_seq, tx.source_account, tx.fee_charged]
      );
    }

    // 3. Write operations
    for (const op of data.operations) {
      await client.query(
        "INSERT INTO operations (id, tx_hash, type, source_account, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
        [op.id, op.tx_hash, op.type, op.source_account, op.created_at]
      );
    }

    // 4. Write payments
    for (const p of data.payments) {
      await client.query(
         "INSERT INTO payments (id, \"from\", \"to\", amount, asset) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
         [p.id, p.from, p.to, p.amount, p.asset]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[loader] failed to write to database:", error);
    throw error;
  } finally {
    client.release();
  }
}
