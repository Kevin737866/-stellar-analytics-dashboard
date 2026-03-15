import { GraphQLResolveInfo } from 'graphql';
import { db } from '../database/connection';

export const analyticsResolvers = {
  Query: {
    networkMetrics: async (
      parent: any,
      args: {
        timeRange?: { startTime?: string; endTime?: string };
      },
      context: any,
      info: GraphQLResolveInfo
    ) => {
      const { startTime, endTime } = args.timeRange || {};

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (startTime) {
        whereClause += ` AND timestamp >= $${paramIndex++}`;
        params.push(startTime);
      }
      if (endTime) {
        whereClause += ` AND timestamp <= $${paramIndex++}`;
        params.push(endTime);
      }

      const query = `
        SELECT 
          timestamp, ledger_count, transaction_count, operation_count,
          active_accounts, total_volume, average_fee, success_rate
        FROM network_metrics 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT 1000
      `;

      const metrics = await db.query(query, params);

      return metrics.map(metric => ({
        timestamp: metric.timestamp,
        ledgerCount: metric.ledger_count,
        transactionCount: metric.transaction_count,
        operationCount: metric.operation_count,
        activeAccounts: metric.active_accounts,
        totalVolume: metric.total_volume,
        averageFee: parseFloat(metric.average_fee),
        successRate: parseFloat(metric.success_rate),
      }));
    },

    assetMetrics: async (
      parent: any,
      args: {
        pagination?: { first?: number; after?: string; last?: number; before?: string };
        filter?: {
          assetType?: string;
          assetCode?: string;
          assetIssuer?: string;
        };
        timeRange?: { startTime?: string; endTime?: string };
      },
      context: any,
      info: GraphQLResolveInfo
    ) => {
      const { first = 50 } = args.pagination || {};
      const { assetType, assetCode, assetIssuer } = args.filter || {};
      const { startTime, endTime } = args.timeRange || {};

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (assetType) {
        whereClause += ` AND a.asset_type = $${paramIndex++}`;
        params.push(assetType);
      }
      if (assetCode) {
        whereClause += ` AND a.asset_code = $${paramIndex++}`;
        params.push(assetCode);
      }
      if (assetIssuer) {
        whereClause += ` AND a.asset_issuer = $${paramIndex++}`;
        params.push(assetIssuer);
      }
      if (startTime) {
        whereClause += ` AND am.timestamp >= $${paramIndex++}`;
        params.push(startTime);
      }
      if (endTime) {
        whereClause += ` AND am.timestamp <= $${paramIndex++}`;
        params.push(endTime);
      }

      const query = `
        SELECT DISTINCT ON (a.id)
          a.asset_type, a.asset_code, a.asset_issuer, a.native,
          am.volume_24h, am.volume_7d, am.volume_30d,
          am.trades_24h, am.trades_7d, am.trades_30d,
          am.price_change_24h, am.market_cap, am.holders
        FROM assets a
        LEFT JOIN asset_metrics am ON a.id = am.asset_id
        ${whereClause}
        ORDER BY a.id, am.timestamp DESC
        LIMIT $${paramIndex}
      `;
      params.push(first);

      const assets = await db.query(query, params);

      return assets.map(asset => ({
        asset: {
          assetType: asset.asset_type,
          assetCode: asset.asset_code,
          assetIssuer: asset.asset_issuer,
          native: asset.native,
        },
        volume24h: asset.volume_24h,
        volume7d: asset.volume_7d,
        volume30d: asset.volume_30d,
        trades24h: asset.trades_24h,
        trades7d: asset.trades_7d,
        trades30d: asset.trades_30d,
        priceChange24h: parseFloat(asset.price_change_24h),
        marketCap: asset.market_cap,
        holders: asset.holders,
      }));
    },

    accountMetrics: async (
      parent: any,
      args: {
        accountId: string;
        timeRange?: { startTime?: string; endTime?: string };
      },
      context: any,
      info: GraphQLResolveInfo
    ) => {
      const { accountId } = args;
      const { startTime, endTime } = args.timeRange || {};

      let whereClause = 'WHERE account_id = $1';
      const params: any[] = [accountId];
      let paramIndex = 2;

      if (startTime) {
        whereClause += ` AND timestamp >= $${paramIndex++}`;
        params.push(startTime);
      }
      if (endTime) {
        whereClause += ` AND timestamp <= $${paramIndex++}`;
        params.push(endTime);
      }

      const query = `
        SELECT 
          account_id, timestamp, balance_native, total_balance_usd,
          transaction_count_24h, transaction_count_7d, transaction_count_30d,
          first_transaction, last_transaction, is_active, trustlines, signers
        FROM account_metrics 
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT 100
      `;

      const metrics = await db.query(query, params);

      return metrics.map(metric => ({
        accountId: metric.account_id,
        balanceNative: metric.balance_native,
        totalBalanceUsd: metric.total_balance_usd,
        transactionCount24h: metric.transaction_count_24h,
        transactionCount7d: metric.transaction_count_7d,
        transactionCount30d: metric.transaction_count_30d,
        firstTransaction: metric.first_transaction,
        lastTransaction: metric.last_transaction,
        isActive: metric.is_active,
        trustlines: metric.trustlines,
        signers: metric.signers,
      }));
    },

    stats: async (
      parent: any,
      args: any,
      context: any,
      info: GraphQLResolveInfo
    ) => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalLedgers,
        totalTransactions,
        totalOperations,
        totalAccounts,
        totalAssets,
        latestLedger,
        activeAccounts24h,
        activeAccounts7d,
        activeAccounts30d,
        volume24h,
        volume7d,
        volume30d,
        averageFee24h,
        successRate24h,
      ] = await Promise.all([
        db.queryOne('SELECT COUNT(*) as count FROM ledgers'),
        db.queryOne('SELECT COUNT(*) as count FROM transactions'),
        db.queryOne('SELECT COUNT(*) as count FROM operations'),
        db.queryOne('SELECT COUNT(*) as count FROM accounts'),
        db.queryOne('SELECT COUNT(*) as count FROM assets'),
        db.queryOne('SELECT sequence, closed_at FROM ledgers ORDER BY sequence DESC LIMIT 1'),
        db.queryOne('SELECT COUNT(DISTINCT source_account) as count FROM transactions WHERE created_at >= $1', [oneDayAgo]),
        db.queryOne('SELECT COUNT(DISTINCT source_account) as count FROM transactions WHERE created_at >= $1', [sevenDaysAgo]),
        db.queryOne('SELECT COUNT(DISTINCT source_account) as count FROM transactions WHERE created_at >= $1', [thirtyDaysAgo]),
        db.queryOne(`
          SELECT COALESCE(SUM(CAST(details->>'amount' AS NUMERIC)), 0) as volume
          FROM operations 
          WHERE type = 'payment' AND created_at >= $1
        `, [oneDayAgo]),
        db.queryOne(`
          SELECT COALESCE(SUM(CAST(details->>'amount' AS NUMERIC)), 0) as volume
          FROM operations 
          WHERE type = 'payment' AND created_at >= $1
        `, [sevenDaysAgo]),
        db.queryOne(`
          SELECT COALESCE(SUM(CAST(details->>'amount' AS NUMERIC)), 0) as volume
          FROM operations 
          WHERE type = 'payment' AND created_at >= $1
        `, [thirtyDaysAgo]),
        db.queryOne('SELECT AVG(fee_charged) as avg_fee FROM transactions WHERE created_at >= $1', [oneDayAgo]),
        db.queryOne(`
          SELECT 
            CASE 
              WHEN COUNT(*) > 0 THEN (COUNT(CASE WHEN successful THEN 1 END) * 100.0 / COUNT(*))
              ELSE 0 
            END as success_rate
          FROM transactions 
          WHERE created_at >= $1
        `, [oneDayAgo]),
      ]);

      return {
        totalLedgers: parseInt(totalLedgers.count),
        totalTransactions: parseInt(totalTransactions.count),
        totalOperations: parseInt(totalOperations.count),
        totalAccounts: parseInt(totalAccounts.count),
        totalAssets: parseInt(totalAssets.count),
        activeAccounts24h: parseInt(activeAccounts24h.count),
        activeAccounts7d: parseInt(activeAccounts7d.count),
        activeAccounts30d: parseInt(activeAccounts30d.count),
        volume24h: volume24h.volume,
        volume7d: volume7h.volume,
        volume30d: volume30h.volume,
        averageFee24h: parseFloat(averageFee24h.avg_fee) || 0,
        successRate24h: parseFloat(successRate24h.success_rate) || 0,
        latestLedger: latestLedger.sequence,
        latestLedgerTime: latestLedger.closed_at,
      };
    },
  },
};
