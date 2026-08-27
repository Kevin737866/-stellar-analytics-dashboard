# @stellar-analytics/shared

Shared TypeScript types, validation schemas, constants, and utilities for the Stellar Analytics monorepo.

---

## Precise Stroop Arithmetic

Stellar lumens (XLM) are divisible to 7 decimal places. The smallest unit is a **stroop**:

$$1\text{ XLM} = 10,000,000\text{ stroops } (10^7)$$

JavaScript native `Number` uses IEEE-754 double-precision floating-point numbers, which introduces two critical failure modes for Stellar accounting:

1. **Floating-point drift**: Binary float representations cannot represent decimal fractions like `0.0000001` or `1.0000001` exactly. Multiplying `0.0000001 * 10000000` produces `0.9999999999999999`, which truncates to `0` with `Math.floor()`.
2. **Safe Integer Limits**: Total XLM circulating supply is approximately 50 Billion XLM ($5 \times 10^{17}$ stroops), far exceeding JavaScript's `Number.MAX_SAFE_INTEGER` ($9,007,199,254,740,991 \approx 9 \times 10^{15}$). Conversions that cast stroops to `Number` silently discard lower digits.

`@stellar-analytics/shared` provides exact, lossless `BigInt` and string-based arithmetic functions in `utils/stroop.ts`:

### Functions

#### `stroopsToXlm(stroops: string | number | bigint): string`
Converts stroop integer amount to an XLM string with exact 7 decimal places.
```typescript
import { stroopsToXlm } from '@stellar-analytics/shared';

stroopsToXlm(1); // "0.0000001"
stroopsToXlm('10000000'); // "1.0000000"
stroopsToXlm('500000000000000000'); // "50000000000.0000000" (50 Billion XLM)
stroopsToXlm(-10000000n); // "-1.0000000"
```

#### `xlmToStroops(xlm: string | number | bigint): string`
Converts XLM decimal representation to exact stroops without `parseFloat` or float multiplication.
```typescript
import { xlmToStroops } from '@stellar-analytics/shared';

xlmToStroops('0.0000001'); // "1"
xlmToStroops('1.0000001'); // "10000001"
xlmToStroops('50000000000'); // "500000000000000000"
```

#### `addStroops(a, b): string` & `subtractStroops(a, b): string`
Exact addition and subtraction of stroop values.
```typescript
import { addStroops, subtractStroops } from '@stellar-analytics/shared';

addStroops('100', '200'); // "300"
subtractStroops('500', '200'); // "300"
```

#### `multiplyStroops(stroops, factor): string`
Lossless scaling of stroops by integer or decimal multiplier.
```typescript
import { multiplyStroops } from '@stellar-analytics/shared';

multiplyStroops('1000', '0.25'); // "250"
multiplyStroops('100', 3n); // "300"
```

#### `compareStroops(a, b): number`
Compares two stroop quantities; returns `-1` if $a < b$, `0` if $a = b$, and `1` if $a > b$.

#### `formatStroops(stroops, options?): string`
Formats stroops into locale-aware grouped digits with optional unit and zero trimming.
```typescript
import { formatStroops } from '@stellar-analytics/shared';

formatStroops('12345678900000'); // "1,234,567.8900000 XLM"
formatStroops('12345678900000', { trimTrailingZeroes: true }); // "1,234,567.89 XLM"
```

---

## Testing

Run unit tests:
```bash
node --test packages/shared/src/tests/stroop.test.ts
```
