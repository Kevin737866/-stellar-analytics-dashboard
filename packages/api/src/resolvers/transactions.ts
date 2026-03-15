import { GraphQLResolveInfo } from 'graphql';
import { db } from '../database/connection';

export const transactionResolvers = {
  Query: {
    transactions: async (
      parent: any,
      args: {
        pagination?: { first?: number; after?: string; last?: number; before?: string };
        timeRange?: { startTime?: string; endTime?: string };
        filter?: {
          successful?: boolean;
          minFee?: number;
          maxFee?: number;
          hasMemo?: boolean;
          memoType?: string;
        };
      },
      context: any,
      info: GraphQLResolveInfo
    ) => {
      const { first = 20, after, last, before } = args.pagination || {};
      const { startTime, endTime } = args.timeRange || {};
      const { successful, minFee, maxFee, hasMemo, memoType } = args.filter || {};

      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (startTime) {
        whereClause += ` AND created_at >= $${paramIndex++}`;
        params.push(startTime);
      }
      if (endTime) {
        whereClause += ` AND created_at <= $${paramIndex++}`;
        params.push(endTime);
      }
      if (successful !== undefined) {
        whereClause += ` AND successful = $${paramIndex++}`;
        params.push(successful);
      }
      if (minFee) {
        whereClause += ` AND fee_charged >= $${paramIndex++}`;
        params.push(minFee);
      }
      if (maxFee) {
        whereClause += ` AND fee_charged <= $${paramIndex++}`;
        params.push(maxFee);
      }
      if (hasMemo !== undefined) {
        whereClause += ` AND memo_type ${hasMemo ? '!=' : '='} $${paramIndex++}`;
        params.push('none');
      }
      if (memoType) {
        whereClause += ` AND memo_type = $${paramIndex++}`;
        params.push(memoType);
      }

      // Handle cursor pagination
      let cursorClause = '';
      if (after) {
        cursorClause = ` AND created_at < $${paramIndex++}`;
        params.push(after);
      } else if (before) {
        cursorClause = ` AND created_at > $${paramIndex++}`;
        params.push(before);
      }

      const limit = Math.min(first || 20, 100);
      const orderBy = after || !before ? 'ORDER BY created_at DESC' : 'ORDER BY created_at ASC';

      const query = `
        SELECT 
          id, paging_token, successful, hash, ledger_sequence, created_at,
          source_account, source_account_sequence, fee_account, fee_charged,
          max_fee, operation_count, envelope_xdr, result_xdr, result_meta_xdr,
          fee_meta_xdr, memo_type, memo, signatures, valid_after, valid_before,
          fee_bump_transaction, inner_transaction_hash, inner_transaction_signatures
        FROM transactions 
        ${whereClause}
        ${cursorClause}
        ${orderBy}
        LIMIT $${paramIndex}
      `;
      params.push(limit);

      const transactions = await db.query(query, params);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM transactions 
        ${whereClause}
      `;
      const countResult = await db.queryOne(countQuery, params.slice(0, -1));
      const totalCount = parseInt(countResult.total);

      // Create edges
      const edges = transactions.map((tx, index) => ({
        cursor: tx.paging_token,
        node: {
          ...tx,
          createdAt: tx.created_at,
          sourceAccount: tx.source_account,
          sourceAccountSequence: tx.source_account_sequence,
          feeAccount: tx.fee_account,
          feeCharged: tx.fee_charged,
          maxFee: tx.max_fee,
          operationCount: tx.operation_count,
          envelopeXdr: tx.envelope_xdr,
          resultXdr: tx.result_xdr,
          resultMetaXdr: tx.result_meta_xdr,
          feeMetaXdr: tx.fee_meta_xdr,
          memoType: tx.memo_type,
          validAfter: tx.valid_after,
          validBefore: tx.valid_before,
          feeBumpTransaction: tx.fee_bump_transaction,
          innerTransactionHash: tx.inner_transaction_hash,
          innerTransactionSignatures: tx.inner_transaction_signatures,
        },
      }));

      // Create page info
      const startCursor = edges.length > 0 ? edges[0].cursor : null;
      const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;
      
      const hasNextPage = edges.length === limit;
      const hasPreviousPage = after ? true : false;

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor,
          endCursor,
        },
        totalCount,
      };
    },

    transaction: async (
      parent: any,
      args: { hash: string },
      context: any,
      info: GraphQLResolveInfo
    ) => {
      const transaction = await db.queryOne(
        `SELECT 
          id, paging_token, successful, hash, ledger_sequence, created_at,
          source_account, source_account_sequence, fee_account, fee_charged,
          max_fee, operation_count, envelope_xdr, result_xdr, result_meta_xdr,
          fee_meta_xdr, memo_type, memo, signatures, valid_after, valid_before,
          fee_bump_transaction, inner_transaction_hash, inner_transaction_signatures
        FROM transactions WHERE hash = $1`,
        [args.hash]
      );

      if (!transaction) return null;

      return {
        ...transaction,
        createdAt: transaction.created_at,
        sourceAccount: transaction.source_account,
        sourceAccountSequence: transaction.source_account_sequence,
        feeAccount: transaction.fee_account,
        feeCharged: transaction.fee_charged,
        maxFee: transaction.max_fee,
        operationCount: transaction.operation_count,
        envelopeXdr: transaction.envelope_xdr,
        resultXdr: transaction.result_xdr,
        resultMetaXdr: transaction.result_meta_xdr,
        feeMetaXdr: transaction.fee_meta_xdr,
        memoType: transaction.memo_type,
        validAfter: transaction.valid_after,
        validBefore: transaction.valid_before,
        feeBumpTransaction: transaction.fee_bump_transaction,
        innerTransactionHash: transaction.inner_transaction_hash,
        innerTransactionSignatures: transaction.inner_transaction_signatures,
      };
    },
  },

  Transaction: {
    operations: async (
      parent: any,
      args: any,
      context: any,
      info: GraphQLResolveInfo
    ) => {
      const operations = await db.query(
        `SELECT 
          id, paging_token, transaction_hash, transaction_successful,
          type, created_at, source_account, ledger_sequence, operation_index, details
        FROM operations 
        WHERE transaction_hash = $1 
        ORDER BY operation_index ASC`,
        [parent.hash]
      );

      return operations.map(op => ({
        ...op,
        createdAt: op.created_at,
        transactionHash: op.transaction_hash,
        transactionSuccessful: op.transaction_successful,
        sourceAccount: op.source_account,
        ledgerSequence: op.ledger_sequence,
        operationIndex: op.operation_index,
      }));
    },
  },
};
