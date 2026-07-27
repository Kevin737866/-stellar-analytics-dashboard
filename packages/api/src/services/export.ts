import { Response } from 'express';
import { db } from '../database/connection';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

function formatCSVValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sendCSV(res: Response, filename: string, headers: string[], rows: any[][]): void {
  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map(formatCSVValue).join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

function sendJSON(res: Response, filename: string, data: any[]): void {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(data);
}

export async function exportTransactions(
  res: Response,
  options: { startTime?: string; endTime?: string; format?: string; limit?: number }
): Promise<void> {
  try {
    const { startTime, endTime, format = 'csv', limit = 10000 } = options;

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

    params.push(limit);
    const rows = await db.query(
      `SELECT id, paging_token, successful, hash, ledger_sequence, created_at,
        source_account, fee_charged, max_fee, operation_count, memo_type, memo
      FROM transactions ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}`,
      params
    );

    const headers = ['id', 'paging_token', 'successful', 'hash', 'ledger_sequence', 'created_at',
      'source_account', 'fee_charged', 'max_fee', 'operation_count', 'memo_type', 'memo'];

    if (format === 'json') {
      sendJSON(res, 'transactions.json', rows);
    } else {
      sendCSV(res, 'transactions.csv', headers, rows.map((r) => headers.map((h) => r[h])));
    }
  } catch (error) {
    logger.error('Export transactions failed', { error });
    res.status(500).json({ error: 'Export failed' });
  }
}

export async function exportLedgers(
  res: Response,
  options: { startTime?: string; endTime?: string; format?: string; limit?: number }
): Promise<void> {
  try {
    const { startTime, endTime, format = 'csv', limit = 10000 } = options;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (startTime) {
      whereClause += ` AND closed_at >= $${paramIndex++}`;
      params.push(startTime);
    }
    if (endTime) {
      whereClause += ` AND closed_at <= $${paramIndex++}`;
      params.push(endTime);
    }

    params.push(limit);
    const rows = await db.query(
      `SELECT id, sequence, successful_transaction_count, failed_transaction_count,
        operation_count, closed_at, total_coins, fee_pool, base_fee_in_stroops,
        base_reserve_in_stroops, protocol_version
      FROM ledgers ${whereClause}
      ORDER BY sequence DESC
      LIMIT $${paramIndex}`,
      params
    );

    const headers = ['id', 'sequence', 'successful_transaction_count', 'failed_transaction_count',
      'operation_count', 'closed_at', 'total_coins', 'fee_pool', 'base_fee_in_stroops',
      'base_reserve_in_stroops', 'protocol_version'];

    if (format === 'json') {
      sendJSON(res, 'ledgers.json', rows);
    } else {
      sendCSV(res, 'ledgers.csv', headers, rows.map((r) => headers.map((h) => r[h])));
    }
  } catch (error) {
    logger.error('Export ledgers failed', { error });
    res.status(500).json({ error: 'Export failed' });
  }
}

export async function exportOperations(
  res: Response,
  options: { startTime?: string; endTime?: string; format?: string; limit?: number }
): Promise<void> {
  try {
    const { startTime, endTime, format = 'csv', limit = 10000 } = options;

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

    params.push(limit);
    const rows = await db.query(
      `SELECT id, paging_token, transaction_hash, transaction_successful,
        type, created_at, source_account, ledger_sequence, operation_index, details
      FROM operations ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}`,
      params
    );

    const headers = ['id', 'paging_token', 'transaction_hash', 'transaction_successful',
      'type', 'created_at', 'source_account', 'ledger_sequence', 'operation_index', 'details'];

    if (format === 'json') {
      sendJSON(res, 'operations.json', rows.map((r) => ({
        ...r,
        details: typeof r.details === 'string' ? r.details : JSON.stringify(r.details),
      })));
    } else {
      sendCSV(res, 'operations.csv', headers, rows.map((r) =>
        headers.map((h) => (h === 'details' ? JSON.stringify(r[h]) : r[h]))
      ));
    }
  } catch (error) {
    logger.error('Export operations failed', { error });
    res.status(500).json({ error: 'Export failed' });
  }
}
