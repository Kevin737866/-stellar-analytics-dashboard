/**
 * Issue #499 Shared: Use precise stroop arithmetic
 *
 * Provides exact, lossless arithmetic for Stellar stroops and XLM conversions
 * using native BigInt and string parsing. Eliminates IEEE-754 floating-point
 * rounding errors, precision loss above Number.MAX_SAFE_INTEGER, and decimal drift.
 */

export const STROOPS_PER_XLM = 10_000_000n;
export const STROOP_DECIMALS = 7;

/**
 * Normalizes input value to BigInt stroops.
 * Validates integer boundaries and rejects malformed values.
 */
export function toBigIntStroops(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Expected finite number for stroops, got: ${value}`);
    }
    if (!Number.isInteger(value)) {
      throw new TypeError(`Stroops must be an integer, got floating-point number: ${value}`);
    }
    return BigInt(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new TypeError('Stroop string value cannot be empty');
    }
    if (!/^[+-]?\d+$/.test(trimmed)) {
      throw new TypeError(`Invalid integer format for stroops: "${value}"`);
    }
    return BigInt(trimmed);
  }

  throw new TypeError(`Unsupported stroop type: ${typeof value}`);
}

/**
 * Convert stroops to XLM with exact 7 decimal places.
 * Uses BigInt integer division and modulo with zero floating-point math.
 */
export function stroopsToXlm(stroops: string | number | bigint): string {
  const stroopBig = toBigIntStroops(stroops);
  const isNegative = stroopBig < 0n;
  const absStroops = isNegative ? -stroopBig : stroopBig;

  const whole = absStroops / STROOPS_PER_XLM;
  const remainder = absStroops % STROOPS_PER_XLM;
  const fractional = remainder.toString().padStart(STROOP_DECIMALS, '0');

  const sign = isNegative ? '-' : '';
  return `${sign}${whole.toString()}.${fractional}`;
}

/**
 * Convert an XLM representation to exact stroops.
 * Parses the string representation directly without parseFloat or Math.floor.
 */
export function xlmToStroops(xlm: string | number | bigint): string {
  if (typeof xlm === 'bigint') {
    return (xlm * STROOPS_PER_XLM).toString();
  }

  let str = typeof xlm === 'number' ? xlm.toString() : xlm.trim();

  if (str === '') {
    throw new TypeError('XLM string value cannot be empty');
  }

  // Handle scientific notation (e.g. 1e-7) safely
  if (/[eE]/.test(str)) {
    const num = Number(str);
    if (!Number.isFinite(num)) {
      throw new TypeError(`Invalid XLM exponential value: ${str}`);
    }
    str = num.toFixed(7);
  }

  const isNegative = str.startsWith('-');
  const cleanStr = str.replace(/^[+-]/, '');

  if (!/^\d+(\.\d*)?$/.test(cleanStr) && !/^\.\d+$/.test(cleanStr)) {
    throw new TypeError(`Invalid XLM numeric format: "${xlm}"`);
  }

  const parts = cleanStr.split('.');
  const wholePart = parts[0] === '' ? '0' : parts[0];
  const fracPart = parts[1] || '';

  if (fracPart.length > STROOP_DECIMALS) {
    throw new RangeError(
      `XLM precision cannot exceed 7 decimal places (1 stroop = 0.0000001 XLM). Received: "${xlm}"`
    );
  }

  const paddedFrac = fracPart.padEnd(STROOP_DECIMALS, '0');
  const wholeBig = BigInt(wholePart);
  const fracBig = BigInt(paddedFrac);

  const totalStroops = wholeBig * STROOPS_PER_XLM + fracBig;
  const signedTotal = isNegative ? -totalStroops : totalStroops;

  return signedTotal.toString();
}

/**
 * Precise addition of two stroop values.
 */
export function addStroops(
  a: string | number | bigint,
  b: string | number | bigint
): string {
  return (toBigIntStroops(a) + toBigIntStroops(b)).toString();
}

/**
 * Precise subtraction of two stroop values (a - b).
 */
export function subtractStroops(
  a: string | number | bigint,
  b: string | number | bigint
): string {
  return (toBigIntStroops(a) - toBigIntStroops(b)).toString();
}

/**
 * Precise multiplication of stroops by a whole number or multiplier string.
 */
export function multiplyStroops(
  stroops: string | number | bigint,
  multiplier: string | number | bigint
): string {
  const stroopBig = toBigIntStroops(stroops);

  if (typeof multiplier === 'bigint' || typeof multiplier === 'number') {
    if (typeof multiplier === 'number' && !Number.isInteger(multiplier)) {
      // Split decimal multiplier for lossless scaling
      const multStr = multiplier.toString();
      return scaleStroopsByDecimal(stroopBig, multStr);
    }
    return (stroopBig * BigInt(multiplier)).toString();
  }

  if (typeof multiplier === 'string') {
    const trimmed = multiplier.trim();
    if (/^[+-]?\d+$/.test(trimmed)) {
      return (stroopBig * BigInt(trimmed)).toString();
    }
    if (/^[+-]?\d+\.\d+$/.test(trimmed)) {
      return scaleStroopsByDecimal(stroopBig, trimmed);
    }
    throw new TypeError(`Invalid multiplier format: "${multiplier}"`);
  }

  throw new TypeError(`Unsupported multiplier type: ${typeof multiplier}`);
}

/**
 * Helper to scale stroops by a decimal string without floating point drift.
 */
function scaleStroopsByDecimal(stroops: bigint, decimalStr: string): string {
  const isNegative = decimalStr.startsWith('-');
  const clean = decimalStr.replace(/^[+-]/, '');
  const [whole, frac] = clean.split('.');
  const scale = frac.length;
  const factor = 10n ** BigInt(scale);
  const multiplierBig = BigInt(whole) * factor + BigInt(frac);

  const product = (stroops * multiplierBig) / factor;
  return (isNegative ? -product : product).toString();
}

/**
 * Compare two stroop values.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
export function compareStroops(
  a: string | number | bigint,
  b: string | number | bigint
): number {
  const aBig = toBigIntStroops(a);
  const bBig = toBigIntStroops(b);

  if (aBig < bBig) return -1;
  if (aBig > bBig) return 1;
  return 0;
}

/**
 * Format stroops into human-readable XLM display with digit grouping.
 */
export function formatStroops(
  stroops: string | number | bigint,
  options?: { showUnit?: boolean; trimTrailingZeroes?: boolean }
): string {
  const xlm = stroopsToXlm(stroops);
  const isNegative = xlm.startsWith('-');
  const clean = isNegative ? xlm.slice(1) : xlm;
  const [whole, frac] = clean.split('.');

  // Format whole portion with comma grouping without parseFloat
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let displayFrac = frac;

  if (options?.trimTrailingZeroes) {
    displayFrac = displayFrac.replace(/0+$/, '');
    if (displayFrac === '') {
      displayFrac = '0';
    }
  }

  const sign = isNegative ? '-' : '';
  const unit = options?.showUnit !== false ? ' XLM' : '';
  return `${sign}${formattedWhole}.${displayFrac}${unit}`;
}
