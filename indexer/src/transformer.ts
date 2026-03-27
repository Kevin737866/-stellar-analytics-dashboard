import type { IngestedData } from "./ingester.js";

export function normalizeLedger(data: IngestedData) {
  const { ledger } = data;
  return {
    sequence: ledger.sequence,
    hash: ledger.hash,
    close_time: ledger.closed_at,
    tx_count: ledger.successful_transaction_count,
  };
}

export function normalizeTransactions(data: IngestedData) {
  return data.transactions.map((tx) => ({
    hash: tx.hash,
    ledger_seq: tx.ledger,
    source_account: tx.source_account,
    fee_charged: tx.fee_charged,
  }));
}

export function normalizeOperations(data: IngestedData) {
  return data.operations.map((op) => ({
    id: op.id,
    tx_hash: op.transaction_hash,
    type: op.type,
    source_account: op.source_account,
    created_at: op.created_at,
  }));
}

export function normalizePayments(data: IngestedData) {
  const paymentTypes = ["payment", "path_payment_strict_receive", "path_payment_strict_send"];
  return data.operations
    .filter((op) => paymentTypes.includes(op.type))
    .map((op: any) => ({
      id: op.id,
      from: op.from || op.source_account,
      to: op.to || op.source_account,
      amount: op.amount || "0",
      asset: op.asset_type === "native" ? "XLM" : op.asset_code,
    }));
}
