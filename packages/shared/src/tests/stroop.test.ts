import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  STROOPS_PER_XLM,
  STROOP_DECIMALS,
  toBigIntStroops,
  stroopsToXlm,
  xlmToStroops,
  addStroops,
  subtractStroops,
  multiplyStroops,
  compareStroops,
  formatStroops,
} from '../utils/stroop.ts';

describe('Precise Stroop Arithmetic (#499)', () => {
  it('defines correct Stellar constants', () => {
    assert.strictEqual(STROOPS_PER_XLM, 10_000_000n);
    assert.strictEqual(STROOP_DECIMALS, 7);
  });

  describe('toBigIntStroops', () => {
    it('handles BigInt input', () => {
      assert.strictEqual(toBigIntStroops(100n), 100n);
      assert.strictEqual(toBigIntStroops(-50n), -50n);
    });

    it('handles integer number input', () => {
      assert.strictEqual(toBigIntStroops(10000000), 10000000n);
      assert.strictEqual(toBigIntStroops(-100), -100n);
      assert.strictEqual(toBigIntStroops(0), 0n);
    });

    it('rejects floating-point numbers', () => {
      assert.throws(() => toBigIntStroops(10.5), /Stroops must be an integer/);
      assert.throws(() => toBigIntStroops(NaN), /Expected finite number/);
      assert.throws(() => toBigIntStroops(Infinity), /Expected finite number/);
    });

    it('handles valid integer strings', () => {
      assert.strictEqual(toBigIntStroops('10000000'), 10000000n);
      assert.strictEqual(toBigIntStroops('  -500  '), -500n);
      assert.strictEqual(toBigIntStroops('+250'), 250n);
      assert.strictEqual(toBigIntStroops('500000000000000000'), 500000000000000000n);
    });

    it('rejects malformed string numbers', () => {
      assert.throws(() => toBigIntStroops(''), /cannot be empty/);
      assert.throws(() => toBigIntStroops('   '), /cannot be empty/);
      assert.throws(() => toBigIntStroops('10.5'), /Invalid integer format/);
      assert.throws(() => toBigIntStroops('abc'), /Invalid integer format/);
    });
  });

  describe('stroopsToXlm', () => {
    it('converts basic stroop values accurately', () => {
      assert.strictEqual(stroopsToXlm(0), '0.0000000');
      assert.strictEqual(stroopsToXlm(1), '0.0000001');
      assert.strictEqual(stroopsToXlm(10), '0.0000010');
      assert.strictEqual(stroopsToXlm(100), '0.0000100');
      assert.strictEqual(stroopsToXlm(10_000_000), '1.0000000');
      assert.strictEqual(stroopsToXlm(10_000_001), '1.0000001');
      assert.strictEqual(stroopsToXlm(15_500_000), '1.5500000');
    });

    it('handles negative stroop values', () => {
      assert.strictEqual(stroopsToXlm(-1), '-0.0000001');
      assert.strictEqual(stroopsToXlm(-10_000_000), '-1.0000000');
      assert.strictEqual(stroopsToXlm('-5000000'), '-0.5000000');
    });

    it('preserves precision beyond Number.MAX_SAFE_INTEGER without rounding', () => {
      // 50 Billion XLM = 50,000,000,000 * 10,000,000 = 500,000,000,000,000,000 stroops
      const supplyStroops = '500000000000000000';
      assert.strictEqual(stroopsToXlm(supplyStroops), '50000000000.0000000');

      // Value larger than Number.MAX_SAFE_INTEGER (9007199254740991)
      const overSafeStroops = '9007199254740992';
      assert.strictEqual(stroopsToXlm(overSafeStroops), '900719925.4740992');
    });
  });

  describe('xlmToStroops', () => {
    it('converts basic XLM amounts to exact stroops', () => {
      assert.strictEqual(xlmToStroops('0'), '0');
      assert.strictEqual(xlmToStroops('1'), '10000000');
      assert.strictEqual(xlmToStroops('1.5'), '15000000');
      assert.strictEqual(xlmToStroops('0.5'), '5000000');
      assert.strictEqual(xlmToStroops('.5'), '5000000');
      assert.strictEqual(xlmToStroops(10), '100000000');
      assert.strictEqual(xlmToStroops(10n), '100000000');
    });

    it('eliminates the classic 0.0000001 IEEE-754 precision drop bug', () => {
      // Previously Math.floor(0.0000001 * 10000000) was prone to float inaccuracies
      assert.strictEqual(xlmToStroops('0.0000001'), '1');
      assert.strictEqual(xlmToStroops('1.0000001'), '10000001');
      assert.strictEqual(xlmToStroops('29.9999999'), '299999999');
    });

    it('handles negative XLM values', () => {
      assert.strictEqual(xlmToStroops('-1'), '-10000000');
      assert.strictEqual(xlmToStroops('-0.0000001'), '-1');
      assert.strictEqual(xlmToStroops('-1.5'), '-15000000');
    });

    it('handles large supplies without overflow', () => {
      assert.strictEqual(xlmToStroops('50000000000'), '500000000000000000');
      assert.strictEqual(xlmToStroops('50000000000.0000001'), '500000000000000001');
    });

    it('rejects values exceeding 7 decimal places', () => {
      assert.throws(
        () => xlmToStroops('1.00000001'),
        /cannot exceed 7 decimal places/
      );
    });

    it('rejects malformed XLM inputs', () => {
      assert.throws(() => xlmToStroops(''), /cannot be empty/);
      assert.throws(() => xlmToStroops('invalid'), /Invalid XLM numeric format/);
      assert.throws(() => xlmToStroops('1.2.3'), /Invalid XLM numeric format/);
    });
  });

  describe('Stroop Arithmetic helpers', () => {
    it('adds stroops accurately', () => {
      assert.strictEqual(addStroops('100', '200'), '300');
      assert.strictEqual(addStroops('500000000000000000', '1'), '500000000000000001');
      assert.strictEqual(addStroops(100, -50), '50');
    });

    it('subtracts stroops accurately', () => {
      assert.strictEqual(subtractStroops('500', '200'), '300');
      assert.strictEqual(subtractStroops('100', '200'), '-100');
      assert.strictEqual(subtractStroops('500000000000000001', '1'), '500000000000000000');
    });

    it('multiplies stroops without drift', () => {
      assert.strictEqual(multiplyStroops('100', '2'), '200');
      assert.strictEqual(multiplyStroops('100', 3n), '300');
      assert.strictEqual(multiplyStroops('100', '1.5'), '150');
      assert.strictEqual(multiplyStroops('1000', '0.25'), '250');
    });

    it('compares stroops correctly', () => {
      assert.strictEqual(compareStroops('100', '200'), -1);
      assert.strictEqual(compareStroops('200', '100'), 1);
      assert.strictEqual(compareStroops('100', '100'), 0);
      assert.strictEqual(compareStroops('100', 100n), 0);
    });
  });

  describe('formatStroops', () => {
    it('formats stroops with comma grouping', () => {
      assert.strictEqual(formatStroops('10000000'), '1.0000000 XLM');
      assert.strictEqual(formatStroops('12345678900000'), '1,234,567.8900000 XLM');
      assert.strictEqual(
        formatStroops('12345678900000', { trimTrailingZeroes: true }),
        '1,234,567.89 XLM'
      );
      assert.strictEqual(
        formatStroops('10000000', { showUnit: false }),
        '1.0000000'
      );
    });
  });
});
