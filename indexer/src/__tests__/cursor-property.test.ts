/**
 * Issue #502 – Shared: Add cursor property tests.
 *
 * Validates fundamental invariants and property-based guarantees of cursor
 * encoding, decoding, validation, and compound cursor transformations across
 * randomized inputs, boundary conditions, and edge cases.
 */

import {
  encodeCursor,
  decodeCursor,
  decodeCursorJson,
  isValidCursor,
  createCompoundCursor,
  parseCompoundCursor,
  CursorSchema,
  validateCursor,
} from '../../../packages/shared/src/utils/cursor';

// ── Property Test Generators ──────────────────────────────────────────────────

function randomString(length: number, charset?: string): string {
  const chars =
    charset ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_./:;!@#$%^&*()+= ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function randomUnicodeString(length: number): string {
  const unicodePool = [
    '✨',
    '🚀',
    '🌟',
    'Ñ',
    'ç',
    'ø',
    '€',
    '¥',
    '日',
    '本',
    '語',
    'Ω',
    'λ',
    'π',
    'A',
    '1',
    ' ',
  ];
  let result = '';
  for (let i = 0; i < length; i++) {
    result += unicodePool[Math.floor(Math.random() * unicodePool.length)];
  }
  return result;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe('Cursor Property Tests (Issue #502)', () => {
  const ITERATIONS = 100;

  describe('Property 1: Roundtrip Invertibility (decode(encode(s)) === s)', () => {
    it('holds for arbitrary random alphanumeric and punctuation strings', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const len = randomInt(1, 120);
        const original = randomString(len);
        const encoded = encodeCursor(original);
        const decoded = decodeCursor(encoded);
        expect(decoded).toBe(original);
      }
    });

    it('holds for random integer and floating-point numeric tokens', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const num = Math.random() > 0.5 ? randomInt(0, 1000000000) : Math.random() * 100000;
        const encoded = encodeCursor(num);
        const decoded = decodeCursor(encoded);
        expect(decoded).toBe(String(num));
      }
    });

    it('holds for multi-byte UTF-8 and unicode strings', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const len = randomInt(1, 30);
        const original = randomUnicodeString(len);
        const encoded = encodeCursor(original);
        const decoded = decodeCursor(encoded);
        expect(decoded).toBe(original);
      }
    });

    it('holds for compound Stellar cursor formats (e.g. ledgerSeq:txIndex)', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const ledgerSeq = randomInt(1, 50000000);
        const txIndex = randomInt(0, 1000);
        const token = `${ledgerSeq}:${txIndex}`;
        expect(decodeCursor(encodeCursor(token))).toBe(token);
      }
    });
  });

  describe('Property 2: Determinism (encode(s) is pure and idempotent)', () => {
    it('produces identical cursor outputs for identical inputs', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const sample = randomString(randomInt(1, 50));
        const first = encodeCursor(sample);
        const second = encodeCursor(sample);
        const third = encodeCursor(sample);
        expect(first).toBe(second);
        expect(second).toBe(third);
      }
    });
  });

  describe('Property 3: Valid Base64 Invariant & Schema Compliance', () => {
    it('always produces valid base64 strings that pass isValidCursor and CursorSchema', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const sample = randomString(randomInt(1, 60));
        const cursor = encodeCursor(sample);

        // Invariant: Non-empty string
        expect(typeof cursor).toBe('string');
        expect(cursor.length).toBeGreaterThan(0);

        // Invariant: Base64 character set
        expect(cursor).toMatch(/^[A-Za-z0-9+/=]+$/);

        // Invariant: Validation helper and schema accept generated cursor
        expect(isValidCursor(cursor)).toBe(true);
        expect(validateCursor(cursor)).toBe(cursor);
        expect(() => CursorSchema.parse(cursor)).not.toThrow();
      }
    });
  });

  describe('Property 4: Soundness & Rejection of Corrupted Cursors', () => {
    it('rejects corrupted cursor strings with invalid characters or malformed padding', () => {
      const invalidChars = ['@', '#', '$', '%', '^', '&', '*', '(', ')', ' ', '\t', '\n', '!', '~'];

      for (let i = 0; i < ITERATIONS; i++) {
        const valid = encodeCursor(randomString(randomInt(4, 20)));
        // Inject an illegal character at a random position
        const pos = randomInt(0, valid.length - 1);
        const char = invalidChars[randomInt(0, invalidChars.length - 1)];
        const corrupted = valid.slice(0, pos) + char + valid.slice(pos + 1);

        expect(isValidCursor(corrupted)).toBe(false);
        expect(() => decodeCursor(corrupted)).toThrow();
        expect(() => validateCursor(corrupted)).toThrow();
      }
    });

    it('rejects empty, non-string, and nullish values', () => {
      expect(isValidCursor('')).toBe(false);
      expect(isValidCursor('   ')).toBe(false);
      expect(isValidCursor(null)).toBe(false);
      expect(isValidCursor(undefined)).toBe(false);
      expect(isValidCursor(12345)).toBe(false);
      expect(isValidCursor({})).toBe(false);

      expect(() => decodeCursor('')).toThrow();
      expect(() => decodeCursor('   ')).toThrow();
      expect(() => decodeCursor(null as any)).toThrow();
      expect(() => decodeCursor(undefined as any)).toThrow();

      expect(() => encodeCursor(null as any)).toThrow(/null or undefined/);
      expect(() => encodeCursor(undefined as any)).toThrow(/null or undefined/);
      expect(() => encodeCursor('')).toThrow(/empty/);
    });
  });

  describe('Property 5: Compound Cursor Part Preservation', () => {
    it('faithfully preserves sequence of parts through compound encoding and parsing', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const partCount = randomInt(1, 5);
        const parts: string[] = [];
        for (let p = 0; p < partCount; p++) {
          parts.push(randomString(randomInt(1, 15), 'abcdefghijklmnopqrstuvwxyz0123456789'));
        }

        const compound = createCompoundCursor(parts);
        expect(isValidCursor(compound)).toBe(true);

        const recovered = parseCompoundCursor(compound);
        expect(recovered).toEqual(parts);
      }
    });
  });

  describe('Property 6: JSON Object Cursor Roundtrip', () => {
    it('accurately encodes and decodes JSON objects', () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const payload = {
          seq: randomInt(1, 100000),
          token: randomString(10, 'abcdef0123456789'),
          active: i % 2 === 0,
        };

        const cursor = encodeCursor(payload);
        const recovered = decodeCursorJson<typeof payload>(cursor);
        expect(recovered).toEqual(payload);
      }
    });
  });
});
