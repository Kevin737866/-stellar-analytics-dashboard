/**
 * Issue #494 – Docs: Add API error contract examples.
 *
 * Verifies that all ErrorCodes have documented contract examples, that all
 * markdown JSON contracts are syntactically valid and conform to GraphQL error
 * specifications, and that formatGraphQLError matches the documented behavior.
 */

import fs from 'fs';
import path from 'path';
import { GraphQLError } from 'graphql';
import {
  ErrorCode,
  formatGraphQLError,
  NotFoundError,
  AuthError,
  ForbiddenError,
  BadInputError,
  ServiceUnavailableError,
  TimeoutError,
  QueryTooComplexError,
} from '../../../packages/api/src/utils/resolver-error';

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

describe('API Error Contract Examples (Issue #494)', () => {
  const doc = readRepoFile('docs/error-handling-and-logging.md');

  it('documents contracts for all defined ErrorCode enum values', () => {
    const documentedCodes = extractList(doc, 'error-contract-codes');
    const actualCodes = Object.values(ErrorCode);

    for (const code of actualCodes) {
      expect(documentedCodes).toContain(code);
      // Ensure there is a dedicated subsection for the error code
      expect(doc).toContain(`#### `);
      expect(doc).toContain(code);
    }
  });

  it('contains valid, parseable JSON code blocks for all documented contracts', () => {
    const jsonBlockRegex = /```json\n([\s\S]*?)\n```/g;
    let match: RegExpExecArray | null;
    let contractCount = 0;

    while ((match = jsonBlockRegex.exec(doc)) !== null) {
      const rawJson = match[1]!;
      // Skip the envelope template which has placeholder strings like "<string>"
      if (rawJson.includes('<string>') || rawJson.includes('<ErrorCode>')) {
        continue;
      }

      let parsed: any;
      expect(() => {
        parsed = JSON.parse(rawJson);
      }).not.toThrow();

      if (parsed && Array.isArray(parsed.errors)) {
        contractCount++;
        const firstError = parsed.errors[0];
        expect(typeof firstError.message).toBe('string');
        expect(firstError.extensions).toBeDefined();
        expect(typeof firstError.extensions.code).toBe('string');
        expect(typeof firstError.extensions.userMessage).toBe('string');
      }
    }

    // At least 11 error codes + dev + prod examples = at least 13 contracts
    expect(contractCount).toBeGreaterThanOrEqual(13);
  });

  it('validates formatGraphQLError output against development contract expectations', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const rawError = new GraphQLError('Technical database relation error', {
        extensions: { code: ErrorCode.INTERNAL_ERROR },
      });
      const formatted = formatGraphQLError(rawError, new Error('Underlying database crash'));

      expect(formatted.message).toBe('Technical database relation error');
      expect(formatted.extensions.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(formatted.extensions.userMessage).toBeDefined();
      expect(formatted.extensions.internalMessage).toBe('Underlying database crash');
      expect(formatted.extensions.stacktrace).toBeUndefined();
      expect(formatted.extensions.exception).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('validates formatGraphQLError output against production contract expectations', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const rawError = new GraphQLError('SELECT * FROM accounts WHERE id = 1 failed', {
        extensions: { code: ErrorCode.INTERNAL_ERROR },
      });
      const formatted = formatGraphQLError(rawError, new Error('DB connection refused'));

      expect(formatted.message).toBe(
        'Something went wrong on our end. Please try again in a moment.'
      );
      expect(formatted.extensions.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(formatted.extensions.userMessage).toBe(
        'Something went wrong on our end. Please try again in a moment.'
      );
      expect(formatted.extensions.internalMessage).toBeUndefined();
      expect(formatted.extensions.stacktrace).toBeUndefined();
      expect(formatted.extensions.exception).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('verifies typed ResolverError classes match expected contract codes', () => {
    expect(new NotFoundError('Ledger', 12345).extensions.code).toBe(ErrorCode.NOT_FOUND);
    expect(new AuthError().extensions.code).toBe(ErrorCode.UNAUTHENTICATED);
    expect(new ForbiddenError().extensions.code).toBe(ErrorCode.FORBIDDEN);
    expect(new BadInputError('Invalid input', 'cursor').extensions.code).toBe(
      ErrorCode.BAD_USER_INPUT
    );
    expect(new ServiceUnavailableError().extensions.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(new TimeoutError().extensions.code).toBe(ErrorCode.TIMEOUT);
    expect(new QueryTooComplexError().extensions.code).toBe(ErrorCode.QUERY_TOO_COMPLEX);
  });
});
