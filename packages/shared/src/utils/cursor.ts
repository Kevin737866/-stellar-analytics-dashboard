import { z } from 'zod';

/**
 * Internal helper to encode UTF-8 string to base64.
 * Compatible across Node.js, Web Workers, and browser environments.
 */
function toBase64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Internal helper to decode base64 string to UTF-8.
 * Compatible across Node.js, Web Workers, and browser environments.
 */
function fromBase64(b64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf-8');
  }
  return decodeURIComponent(escape(atob(b64)));
}

const BASE64_STRICT_PADDED = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_CHARS = /^[A-Za-z0-9+/=]+$/;

/**
 * Check whether a value is a valid non-empty base64 cursor string.
 */
export function isValidCursor(cursor: unknown): boolean {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    return false;
  }

  // Cursors must not contain any whitespace
  if (/\s/.test(cursor)) {
    return false;
  }

  if (!BASE64_CHARS.test(cursor)) {
    return false;
  }

  // If padded with '=', must follow RFC 4648 multiple-of-4 rules
  if (cursor.includes('=')) {
    if (cursor.length % 4 !== 0 || !BASE64_STRICT_PADDED.test(cursor)) {
      return false;
    }
  } else if (cursor.length % 4 === 1) {
    // A standalone single base64 character cannot encode valid bytes
    return false;
  }

  try {
    fromBase64(cursor);
    return true;
  } catch {
    return false;
  }
}

/**
 * Encode a string, number, or object into an opaque base64 cursor.
 *
 * @param value The primitive value or object to encode.
 * @returns Non-empty base64 string.
 */
export function encodeCursor(value: string | number | Record<string, unknown>): string {
  if (value === null || value === undefined) {
    throw new Error('Cannot encode null or undefined as a cursor');
  }

  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (serialized.length === 0) {
    throw new Error('Cannot encode an empty value as a cursor');
  }

  return toBase64(serialized);
}

/**
 * Decode an opaque base64 cursor back to its original UTF-8 string.
 *
 * @param cursor Base64 encoded cursor.
 * @returns Decoded UTF-8 string.
 * @throws Error if cursor is invalid, empty, or cannot be decoded.
 */
export function decodeCursor(cursor: string): string {
  if (typeof cursor !== 'string' || !cursor) {
    throw new Error('Invalid cursor: cursor must be a non-empty string');
  }

  if (!isValidCursor(cursor)) {
    throw new Error(`Invalid cursor format: ${cursor}`);
  }

  try {
    return fromBase64(cursor);
  } catch {
    throw new Error(`Failed to decode cursor: ${cursor}`);
  }
}

/**
 * Decode a base64 cursor and parse the resulting JSON.
 */
export function decodeCursorJson<T = unknown>(cursor: string): T {
  const decoded = decodeCursor(cursor);
  try {
    return JSON.parse(decoded) as T;
  } catch {
    throw new Error(`Cursor content is not valid JSON: ${decoded}`);
  }
}

/**
 * Create a compound cursor by combining multiple parts (e.g. [sequence, index]).
 *
 * @param parts Array of strings or numbers to combine.
 * @param delimiter Delimiter separating parts (default ':').
 */
export function createCompoundCursor(parts: (string | number)[], delimiter = ':'): string {
  if (!parts || parts.length === 0) {
    throw new Error('Compound cursor parts cannot be empty');
  }
  const joined = parts.map(String).join(delimiter);
  return encodeCursor(joined);
}

/**
 * Parse a compound cursor back into its constituent parts.
 *
 * @param cursor Base64 encoded compound cursor.
 * @param delimiter Delimiter separating parts (default ':').
 */
export function parseCompoundCursor(cursor: string, delimiter = ':'): string[] {
  const decoded = decodeCursor(cursor);
  return decoded.split(delimiter);
}

/**
 * Zod schema for validating cursors.
 */
export const CursorSchema = z.string().min(1, 'Cursor cannot be empty').refine(isValidCursor, {
  message: 'Invalid cursor encoding: must be a valid base64 string',
});

/**
 * Validate cursor with Zod and return the validated string.
 */
export function validateCursor(cursor: unknown): string {
  return CursorSchema.parse(cursor);
}
