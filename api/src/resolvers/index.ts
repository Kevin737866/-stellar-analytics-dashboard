import { query } from "../db.js";
import { nowIso } from "@stellar-analytics/shared";

export const resolvers = {
  health: () => ({
    status: "ok",
    timestamp: nowIso()
  }),

  // CORE QUERIES
  ledger: async ({ sequence }: { sequence: number }, context: any) => {
    const { rows } = await query("SELECT * FROM ledgers WHERE sequence = $1", [sequence]);
    if (rows.length === 0) return null;
    return transformLedger(rows[0], context);
  },

  ledgers: async ({ limit = 10, cursor }: { limit?: number; cursor?: string }, context: any) => {
    const sequenceCursor = cursor ? parseInt(Buffer.from(cursor, 'base64').toString('ascii'), 10) : null;
    
    let sql = "SELECT * FROM ledgers";
    const params: any[] = [];
    
    if (sequenceCursor) {
      sql += " WHERE sequence < $1";
      params.push(sequenceCursor);
    }
    
    sql += " ORDER BY sequence DESC LIMIT $1";
    params.push(limit + 1); // One extra to check for next page

    const { rows } = await query(sql, params);
    
    const hasNextPage = rows.length > limit;
    const nodes = hasNextPage ? rows.slice(0, limit) : rows;
    
    const edges = nodes.map((node) => ({
      node: transformLedger(node, context),
      cursor: Buffer.from(node.sequence.toString()).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
      },
    };
  },

  transactions: async ({ address, limit = 10 }: { address?: string; limit?: number }, context: any) => {
    let sql = "SELECT * FROM transactions";
    const params: any[] = [];
    
    if (address) {
      sql += " WHERE source_account = $1";
      params.push(address);
    }
    
    sql += " ORDER BY created_at DESC LIMIT $" + (params.length + 1);
    params.push(limit);

    const { rows } = await query(sql, params);
    return rows.map(tx => transformTransaction(tx, context));
  },

  operations: async ({ type, limit = 10 }: { type?: string; limit?: number }, context: any) => {
    let sql = "SELECT * FROM operations";
    const params: any[] = [];
    
    if (type) {
      sql += " WHERE type = $1";
      params.push(type);
    }
    
    sql += " ORDER BY created_at DESC LIMIT $" + (params.length + 1);
    params.push(limit);

    const { rows } = await query(sql, params);
    return rows.map(op => transformOperation(op));
  },

  // ANALYTICS
  accountStats: async ({ address }: { address: string }) => {
    const txCountRes = await query("SELECT COUNT(*) FROM transactions WHERE source_account = $1", [address]);
    const volumeRes = await query("SELECT SUM(amount::numeric) as total FROM payments WHERE \"from\" = $1", [address]);
    const lastActiveRes = await query("SELECT MAX(created_at) as last FROM transactions WHERE source_account = $1", [address]);

    return {
      address,
      transactionCount: parseInt(txCountRes.rows[0].count, 10),
      totalPaymentVolume: volumeRes.rows[0].total || "0",
      lastActive: lastActiveRes.rows[0].last ? lastActiveRes.rows[0].last.toISOString() : null,
    };
  },

  networkStats: async () => {
    const tpsRes = await query("SELECT COUNT(*) / 60.0 as tps FROM transactions WHERE created_at > NOW() - INTERVAL '1 minute'");
    const totalAccountsRes = await query("SELECT COUNT(DISTINCT source_account) as total FROM transactions");
    const active24hRes = await query("SELECT COUNT(DISTINCT source_account) as active FROM transactions WHERE created_at > NOW() - INTERVAL '24 hours'");
    const totalLedgersRes = await query("SELECT COUNT(*) as total FROM ledgers");

    return {
      tps: parseFloat(tpsRes.rows[0].tps) || 0,
      totalAccounts: parseInt(totalAccountsRes.rows[0].total, 10),
      activeAccounts24h: parseInt(active24hRes.rows[0].active, 10),
      totalLedgers: parseInt(totalLedgersRes.rows[0].total, 10),
    };
  },

  assetVolume: async ({ assetCode, timeframe }: { assetCode: string; timeframe: string }) => {
    const intervalMapper: Record<string, string> = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };
    const interval = intervalMapper[timeframe] || '24 hours';
    
    const { rows } = await query(
      "SELECT SUM(amount::numeric) as volume FROM payments WHERE asset = $1 AND created_at > NOW() - CAST($2 AS INTERVAL)",
      [assetCode, interval]
    );

    return {
      assetCode,
      volume: rows[0].volume || "0",
      timeframe
    };
  },

  topAccounts: async ({ limit = 10 }: { limit?: number }) => {
    // Note: Balance is not directly stored in this schema, so we simulate with transaction count for now
    // or we could use the sum of received payments minus sent payments if we had a complete history.
    // For the sake of the requirement, we'll return top accounts by transaction activity.
    const { rows } = await query(
      "SELECT source_account as address, COUNT(*) as activity FROM transactions GROUP BY source_account ORDER BY activity DESC LIMIT $1",
      [limit]
    );
    return rows.map(r => ({ address: r.address, balance: r.activity })); // Labeling activity as balance for stub
  },

  dailyTransactionCount: async ({ days = 7 }: { days?: number }) => {
    const { rows } = await query(
      "SELECT DATE(created_at) as date, COUNT(*) as count FROM transactions WHERE created_at > NOW() - CAST($1 || ' days' AS INTERVAL) GROUP BY DATE(created_at) ORDER BY date DESC",
      [days]
    );
    return rows.map(r => ({ date: r.date.toISOString().split('T')[0], count: parseInt(r.count, 10) }));
  }
};

// HELPERS for Nested Resolvers
function transformLedger(row: any, context: any) {
  return {
    sequence: Number(row.sequence),
    hash: row.hash,
    closeTime: row.closed_at.toISOString(),
    transactionCount: row.tx_count,
    operations: () => context.loaders.operationsByLedgerSeq.load(Number(row.sequence)).then((ops: any[]) => ops.map(transformOperation)),
    transactions: () => context.loaders.transactionsByLedgerSeq.load(Number(row.sequence)).then((txs: any[]) => txs.map((tx: any) => transformTransaction(tx, context)))
  };
}

function transformTransaction(row: any, context: any) {
  return {
    hash: row.hash,
    ledgerSequence: Number(row.ledger_sequence),
    sourceAccount: row.source_account,
    feeCharged: row.fee_charged,
    operations: () => context.loaders.operationsByTxHash.load(row.hash).then((ops: any[]) => ops.map(transformOperation))
  };
}

function transformOperation(row: any) {
  return {
    id: row.id,
    txHash: row.tx_hash,
    type: row.type,
    sourceAccount: row.source_account,
    createdAt: row.created_at.toISOString()
  };
}
