DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS ledgers CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS operations CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

CREATE TABLE ledgers (
  sequence BIGINT PRIMARY KEY,
  hash TEXT NOT NULL UNIQUE,
  closed_at TIMESTAMPTZ NOT NULL,
  tx_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transactions (
  hash TEXT PRIMARY KEY,
  ledger_sequence BIGINT NOT NULL REFERENCES ledgers(sequence),
  source_account TEXT NOT NULL,
  fee_charged TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  tx_hash TEXT NOT NULL REFERENCES transactions(hash),
  type TEXT NOT NULL,
  source_account TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY REFERENCES operations(id),
  "from" TEXT NOT NULL,
  "to" TEXT NOT NULL,
  amount TEXT NOT NULL,
  asset TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledgers_closed_at ON ledgers(closed_at);
CREATE INDEX idx_transactions_ledger_sequence ON transactions(ledger_sequence);
CREATE INDEX idx_transactions_source_account ON transactions(source_account);
CREATE INDEX idx_operations_tx_hash ON operations(tx_hash);
CREATE INDEX idx_operations_type ON operations(type);
CREATE INDEX idx_payments_from ON payments("from");
CREATE INDEX idx_payments_to ON payments("to");
CREATE INDEX idx_payments_created_at ON payments(created_at);
