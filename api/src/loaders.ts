import DataLoader from "dataloader";
import { query } from "./db.js";

export const createLoaders = () => {
  return {
    // Fetch operations for multiple transactions
    operationsByTxHash: new DataLoader(async (txHashes: readonly string[]) => {
      const { rows } = await query(
        "SELECT * FROM operations WHERE tx_hash = ANY($1) ORDER BY created_at ASC",
        [txHashes]
      );
      
      const opMap = txHashes.reduce((acc, hash) => {
        acc[hash] = [];
        return acc;
      }, {} as Record<string, any[]>);

      rows.forEach((row) => {
        opMap[row.tx_hash].push(row);
      });

      return txHashes.map((hash) => opMap[hash]);
    }),

    // Fetch transactions for multiple ledgers
    transactionsByLedgerSeq: new DataLoader(async (sequences: readonly number[]) => {
      const { rows } = await query(
        "SELECT * FROM transactions WHERE ledger_sequence = ANY($1) ORDER BY created_at ASC",
        [sequences]
      );

      const txMap = sequences.reduce((acc, seq) => {
        acc[seq] = [];
        return acc;
      }, {} as Record<number, any[]>);

      rows.forEach((row) => {
        txMap[Number(row.ledger_sequence)].push(row);
      });

      return sequences.map((seq) => txMap[seq]);
    }),

    // Fetch operations for multiple ledgers (directly or via txs)
    operationsByLedgerSeq: new DataLoader(async (sequences: readonly number[]) => {
        // Simplified: join with transactions to get ops for ledgers
        const { rows } = await query(
          "SELECT o.*, t.ledger_sequence FROM operations o JOIN transactions t ON o.tx_hash = t.hash WHERE t.ledger_sequence = ANY($1) ORDER BY o.created_at ASC",
          [sequences]
        );
  
        const opMap = sequences.reduce((acc, seq) => {
          acc[seq] = [];
          return acc;
        }, {} as Record<number, any[]>);
  
        rows.forEach((row) => {
          opMap[Number(row.ledger_sequence)].push(row);
        });
  
        return sequences.map((seq) => opMap[seq]);
      }),
  };
};
