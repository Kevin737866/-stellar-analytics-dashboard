/**
 * Issue #495 – Docs: Document mock data limitations.
 *
 * Verifies that mock-data-limitations.md exists, stays in sync with
 * mock-horizon.ts, documents all supported and unsupported operation types,
 * and is referenced in the development guide.
 */

import fs from 'fs';
import path from 'path';
import { createMockHorizonServer } from '../mock-horizon';
import { isValidStellarAddress } from '../../../packages/shared/src/utils/stellar';

const repoRoot = path.resolve(__dirname, '../../../');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractList(content: string, marker: string): string[] {
  const match = content.match(new RegExp(`<!-- ${marker}: ([^>]+) -->`));
  if (!match) {
    throw new Error(`Missing marker <!-- ${marker}: ... --> in documentation`);
  }
  return match[1]!.split(',').map((item) => item.trim());
}

function extractMarker(content: string, name: string): string {
  const match = content.match(new RegExp(`<!-- ${name}: ([^>]+) -->`));
  if (!match) {
    throw new Error(`Missing marker <!-- ${name}: ... --> in documentation`);
  }
  return match[1]!.trim();
}

describe('Mock Data Limitations Documentation (Issue #495)', () => {
  const doc = readRepoFile('docs/mock-data-limitations.md');
  const devGuide = readRepoFile('DEVELOPMENT.md');

  it('documents the correct environment variable for mock mode', () => {
    expect(extractMarker(doc, 'mock-env-var')).toBe('STELLAR_MOCK');
  });

  it('is linked from DEVELOPMENT.md', () => {
    expect(devGuide).toContain('docs/mock-data-limitations.md');
  });

  it('accurately lists the 6 supported operation types from mock-horizon', async () => {
    const supportedOps = extractList(doc, 'mock-supported-ops');
    expect(supportedOps).toEqual([
      'payment',
      'create_account',
      'path_payment_strict_receive',
      'manage_sell_offer',
      'change_trust',
      'account_merge',
    ]);

    // Verify mock server actually cycles through these operation types
    const server = createMockHorizonServer({ startSequence: 200, txsPerLedger: 6, opsPerTx: 1 });
    const opsRes = await server.operations().forLedger(200).call();
    const generatedTypes = opsRes.records.map((r: any) => r.type);

    for (const opType of supportedOps) {
      expect(generatedTypes).toContain(opType);
    }
  });

  it('documents synthetic account format that fails cryptographic address validation', async () => {
    const server = createMockHorizonServer({ startSequence: 300 });
    const ledger = server.__generateLedger(300);
    const txs = server.__generateTransactions(300);

    const sourceAccount = txs[0].source_account;
    expect(sourceAccount).toMatch(/^GAAA\d{52}$/);

    // Verifies the documented limitation: mock account IDs fail real StrKey checksum validation
    expect(isValidStellarAddress(sourceAccount)).toBe(false);
  });

  it('documents placeholder XDR format used in mock records', async () => {
    const server = createMockHorizonServer({ startSequence: 400 });
    const ledger = server.__generateLedger(400);
    const txs = server.__generateTransactions(400);

    expect(ledger.header_xdr).toBe('MOCK_LEDGER_XDR_400');
    expect(txs[0].envelope_xdr).toContain('MOCK_TX_ENVELOPE_XDR_');
    expect(txs[0].result_meta_xdr).toBe('MOCK_META');
    expect(txs[0].fee_meta_xdr).toBe('MOCK_FEE_META');
  });

  it('documents unsupported features list in sync with markers', () => {
    const unsupported = extractList(doc, 'mock-unsupported-features');
    expect(unsupported).toContain('soroban-contracts');
    expect(unsupported).toContain('cryptographic-signatures');
    expect(unsupported).toContain('liquidity-pools');
    expect(unsupported).toContain('claimable-balances');
  });
});
