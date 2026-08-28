/**
 * Issue #498 – tightened asset parser validation in packages/shared.
 */

import { parseAsset } from '../../../packages/shared/src/utils/stellar';

const VALID_ISSUER = `G${'A'.repeat(55)}`;

describe('parseAsset (issue #498)', () => {
  it('parses native shorthand values', () => {
    expect(parseAsset('XLM')).toEqual({ asset_type: 'native', native: true });
    expect(parseAsset('native')).toEqual({ asset_type: 'native', native: true });
    expect(parseAsset('  XLM  ')).toEqual({ asset_type: 'native', native: true });
  });

  it('parses valid credit assets', () => {
    expect(parseAsset(`USD:${VALID_ISSUER}`)).toEqual({
      asset_type: 'credit_alphanum4',
      asset_code: 'USD',
      asset_issuer: VALID_ISSUER,
    });

    expect(parseAsset(`LONGTOKEN:${VALID_ISSUER}`)).toEqual({
      asset_type: 'credit_alphanum12',
      asset_code: 'LONGTOKEN',
      asset_issuer: VALID_ISSUER,
    });
  });

  it('rejects empty and malformed strings', () => {
    expect(() => parseAsset('')).toThrow(/empty string/);
    expect(() => parseAsset('   ')).toThrow(/empty string/);
    expect(() => parseAsset('USD')).toThrow(/Invalid asset format/);
    expect(() => parseAsset(`USD:${VALID_ISSUER}:extra`)).toThrow(/Invalid asset format/);
    expect(() => parseAsset(`:${VALID_ISSUER}`)).toThrow(/Invalid asset format/);
    expect(() => parseAsset(`USD:`)).toThrow(/Invalid asset format/);
  });

  it('rejects invalid asset codes and issuers', () => {
    expect(() => parseAsset(`US$:${VALID_ISSUER}`)).toThrow();
    expect(() => parseAsset(`${'A'.repeat(13)}:${VALID_ISSUER}`)).toThrow();
    expect(() => parseAsset(`USD:NOT_A_STELLAR_ADDRESS`)).toThrow();
    expect(() => parseAsset(`USD:G${'A'.repeat(54)}`)).toThrow();
  });
});
