/**
 * Consistent error formatting and logging utilities for GraphQL resolvers.
 *
 * Issue #340 – Add API error classification and user-friendly messages:
 *   - Errors are classified into well-known categories with stable `code` values.
 *   - Each category maps to a concise `userMessage` safe for display in the UI.
 *   - Internal details (stack traces, DB messages, SQL) are kept in server logs only.
 *   - The Apollo Server `formatError` hook (`formatGraphQLError`) is exported so the
 *     API server can strip sensitive information before sending errors to clients.
 *
 * Usage:
 *   import { withResolverLogging, ResolverError, NotFoundError, AuthError } from '../utils/resolver-error';
 *
 *   myResolver: withResolverLogging('Query.myResolver', async (parent, args, context) => {
 *     // resolver body — throw ResolverError subclasses for known error cases
 *   }),
 */

import { GraphQLError } from 'graphql';
import type winston from 'winston';

// ── Error codes ───────────────────────────────────────────────────────────────

export const ErrorCode = {
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  RATE_LIMITED: 'RATE_LIMITED',
  /** Upstream Stellar Horizon service is unavailable */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  /** Request timed out before the server could respond */
  TIMEOUT: 'TIMEOUT',
  /** Query complexity or depth exceeded the configured limit */
  QUERY_TOO_COMPLEX: 'QUERY_TOO_COMPLEX',
  /** Persisted query hash not found in the APQ cache */
  PERSISTED_QUERY_NOT_FOUND: 'PERSISTED_QUERY_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ── User-friendly message map ─────────────────────────────────────────────────
//
// Each error code maps to a short, non-technical message that is safe to
// display verbatim in the frontend. These messages do NOT contain any internal
// details (SQL, stack traces, hostnames, etc.).

const USER_MESSAGES: Record<ErrorCode, string> = {
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again in a moment.',
  NOT_FOUND: 'The requested resource could not be found.',
  UNAUTHENTICATED: 'You must be signed in to access this resource.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  VALIDATION_ERROR: 'The request contains invalid parameters. Please review your input and try again.',
  BAD_USER_INPUT: 'The request contains invalid input. Please check your values and try again.',
  RATE_LIMITED: 'Too many requests. Please slow down and try again shortly.',
  SERVICE_UNAVAILABLE: 'A required service is temporarily unavailable. Please try again later.',
  TIMEOUT: 'The request took too long to complete. Please try again.',
  QUERY_TOO_COMPLEX: 'The query is too complex. Please reduce the number of requested fields or lower the pagination limit.',
  PERSISTED_QUERY_NOT_FOUND: 'Cached query not found. Please resend the full query.',
};

/**
 * Return the user-friendly message for a given error code.
 * Falls back to the INTERNAL_ERROR message for unknown codes.
 */
export function getUserMessage(code: string): string {
  return USER_MESSAGES[code as ErrorCode] ?? USER_MESSAGES.INTERNAL_ERROR;
}

// ── Typed error classes ───────────────────────────────────────────────────────

/**
 * Base class for all resolver-level errors.
 * Extends GraphQLError so Apollo Server serialises it correctly.
 */
export class ResolverError extends GraphQLError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    extensions?: Record<string, unknown>
  ) {
    super(message, {
      extensions: {
        code,
        timestamp: new Date().toISOString(),
        ...extensions,
      },
    });
    this.name = 'ResolverError';
  }
}

/** Resource could not be found (maps to NOT_FOUND). */
export class NotFoundError extends ResolverError {
  constructor(resource: string, identifier?: string | number) {
    const detail = identifier !== undefined ? ` (${identifier})` : '';
    super(`${resource}${detail} not found`, ErrorCode.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

/** Request requires authentication (maps to UNAUTHENTICATED). */
export class AuthError extends ResolverError {
  constructor(message = 'Authentication required') {
    super(message, ErrorCode.UNAUTHENTICATED);
    this.name = 'AuthError';
  }
}

/** Authenticated user lacks permission (maps to FORBIDDEN). */
export class ForbiddenError extends ResolverError {
  constructor(message = 'You do not have permission to perform this action') {
    super(message, ErrorCode.FORBIDDEN);
    this.name = 'ForbiddenError';
  }
}

/** Client supplied invalid input (maps to BAD_USER_INPUT). */
export class BadInputError extends ResolverError {
  constructor(message: string, field?: string) {
    super(message, ErrorCode.BAD_USER_INPUT, field ? { field } : undefined);
    this.name = 'BadInputError';
  }
}

/** Upstream service (e.g. Stellar Horizon) is temporarily unavailable. */
export class ServiceUnavailableError extends ResolverError {
  constructor(message = 'A required service is temporarily unavailable') {
    super(message, ErrorCode.SERVICE_UNAVAILABLE);
    this.name = 'ServiceUnavailableError';
  }
}

/** The operation exceeded its allowed time budget. */
export class TimeoutError extends ResolverError {
  constructor(message = 'The operation timed out') {
    super(message, ErrorCode.TIMEOUT);
    this.name = 'TimeoutError';
  }
}

/** The query exceeds the configured complexity or depth limit. */
export class QueryTooComplexError extends ResolverError {
  constructor(message = 'Query complexity limit exceeded') {
    super(message, ErrorCode.QUERY_TOO_COMPLEX);
    this.name = 'QueryTooComplexError';
  }
}

// ── Logging helpers ───────────────────────────────────────────────────────────

/**
 * Classify an error for logging purposes.
 * Known resolver errors are "expected" and logged at warn level.
 * Everything else is an unexpected server error logged at error level.
 */
function classifyError(err: unknown): { level: 'warn' | 'error'; isOperational: boolean } {
  if (err instanceof ResolverError) {
    // Operational errors — expected, no stack trace needed
    return { level: 'warn', isOperational: true };
  }
  if (err instanceof GraphQLError) {
    // Validation / depth-limit errors from Apollo — expected
    return { level: 'warn', isOperational: true };
  }
  // Unexpected errors (DB failures, programming errors, etc.)
  return { level: 'error', isOperational: false };
}

/**
 * Format an error into a structured log payload.
 */
function formatErrorPayload(
  resolverName: string,
  err: unknown,
  args: unknown,
  userId?: string
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    resolver: resolverName,
    userId: userId ?? 'anonymous',
    args: sanitiseArgs(args),
  };

  if (err instanceof GraphQLError) {
    return {
      ...base,
      errorCode: err.extensions?.code ?? ErrorCode.INTERNAL_ERROR,
      message: err.message,
    };
  }

  if (err instanceof Error) {
    return {
      ...base,
      errorCode: ErrorCode.INTERNAL_ERROR,
      message: err.message,
      // Only include stack for unexpected errors — stripped in production by log level
      stack: err.stack,
    };
  }

  return {
    ...base,
    errorCode: ErrorCode.INTERNAL_ERROR,
    message: String(err),
  };
}

/**
 * Strip sensitive fields from resolver args before logging.
 */
function sanitiseArgs(args: unknown): unknown {
  if (!args || typeof args !== 'object') return args;
  const sensitive = new Set(['password', 'token', 'apiKey', 'api_key', 'secret']);
  return Object.fromEntries(
    Object.entries(args as Record<string, unknown>).map(([k, v]) => [
      k,
      sensitive.has(k) ? '[REDACTED]' : v,
    ])
  );
}

/**
 * Re-throw an unknown error as a ResolverError so the client always receives
 * a consistent GraphQL error shape. Internal details are hidden in production.
 */
function normaliseError(err: unknown): GraphQLError {
  if (err instanceof GraphQLError) return err;

  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction
    ? 'An unexpected error occurred. Please try again later.'
    : err instanceof Error
    ? err.message
    : String(err);

  return new ResolverError(message, ErrorCode.INTERNAL_ERROR);
}

// ── Apollo Server formatError hook ───────────────────────────────────────────

/**
 * Derive a stable `ErrorCode` from a raw GraphQL error.
 *
 * Priority order:
 *   1. The `code` already present in `error.extensions` (set by our resolver classes)
 *   2. Apollo's built-in codes (GRAPHQL_VALIDATION_FAILED, PERSISTED_QUERY_NOT_FOUND, etc.)
 *   3. Keyword matching on the error message for common patterns
 *   4. Fall back to INTERNAL_ERROR
 */
function classifyErrorCode(error: GraphQLError): ErrorCode {
  const ext = error.extensions ?? {};

  // 1. Trust our own code if already present
  if (ext.code && typeof ext.code === 'string') {
    const knownCodes = Object.values(ErrorCode) as string[];
    if (knownCodes.includes(ext.code as string)) {
      return ext.code as ErrorCode;
    }
    // Map Apollo's built-in codes to ours
    if (ext.code === 'GRAPHQL_VALIDATION_FAILED' || ext.code === 'GRAPHQL_PARSE_FAILED') {
      return ErrorCode.VALIDATION_ERROR;
    }
    if (ext.code === 'PERSISTED_QUERY_NOT_FOUND') {
      return ErrorCode.PERSISTED_QUERY_NOT_FOUND;
    }
    if (ext.code === 'UNAUTHENTICATED') {
      return ErrorCode.UNAUTHENTICATED;
    }
    if (ext.code === 'FORBIDDEN') {
      return ErrorCode.FORBIDDEN;
    }
  }

  // 2. Keyword matching on message
  const msg = error.message.toLowerCase();
  if (msg.includes('not found')) return ErrorCode.NOT_FOUND;
  if (msg.includes('unauthorized') || msg.includes('authentication required') || msg.includes('must be signed')) {
    return ErrorCode.UNAUTHENTICATED;
  }
  if (msg.includes('permission') || msg.includes('forbidden')) return ErrorCode.FORBIDDEN;
  if (msg.includes('rate limit') || msg.includes('too many requests')) return ErrorCode.RATE_LIMITED;
  if (msg.includes('timeout') || msg.includes('timed out')) return ErrorCode.TIMEOUT;
  if (msg.includes('complexity') || msg.includes('depth limit')) return ErrorCode.QUERY_TOO_COMPLEX;
  if (msg.includes('unavailable') || msg.includes('connection refused') || msg.includes('econnrefused')) {
    return ErrorCode.SERVICE_UNAVAILABLE;
  }
  if (msg.includes('invalid') || msg.includes('validation')) return ErrorCode.VALIDATION_ERROR;

  return ErrorCode.INTERNAL_ERROR;
}

/**
 * Apollo Server `formatError` hook (issue #340).
 *
 * - Attaches a classified `code` and a `userMessage` to every error's extensions
 *   so the frontend can show a consistent, non-technical message.
 * - In production the original `message` is replaced by the user-friendly copy to
 *   prevent accidental leakage of internal details (SQL, stack traces, hostnames).
 * - In development the original message is preserved and moved to `internalMessage`
 *   for easier debugging.
 * - The `stacktrace` field is always removed from client-facing responses.
 *
 * @example Extension payload sent to the client:
 * ```json
 * {
 *   "code": "NOT_FOUND",
 *   "userMessage": "The requested resource could not be found.",
 *   "timestamp": "2026-08-27T12:00:00.000Z"
 * }
 * ```
 */
export function formatGraphQLError(
  formattedError: GraphQLError,
  originalError: unknown
): GraphQLError {
  const code = classifyErrorCode(formattedError);
  const userMessage = getUserMessage(code);
  const isProduction = process.env.NODE_ENV === 'production';

  const baseExtensions: Record<string, unknown> = {
    ...(formattedError.extensions ?? {}),
    code,
    userMessage,
    timestamp: formattedError.extensions?.timestamp ?? new Date().toISOString(),
  };

  // Always strip stack traces from client responses
  delete baseExtensions.stacktrace;
  delete baseExtensions.exception;

  if (isProduction) {
    // Replace the technical message with the user-friendly copy so nothing
    // internal (SQL errors, hostnames, stack frames) leaks to the client.
    return new GraphQLError(userMessage, {
      nodes: formattedError.nodes,
      source: formattedError.source,
      positions: formattedError.positions,
      path: formattedError.path,
      originalError: formattedError.originalError,
      extensions: baseExtensions,
    });
  }

  // Development: keep the original message but also surface it clearly and add
  // the internalMessage for easy inspection in GraphQL playground / curl.
  const internalMessage =
    originalError instanceof Error ? originalError.message : formattedError.message;

  return new GraphQLError(formattedError.message, {
    nodes: formattedError.nodes,
    source: formattedError.source,
    positions: formattedError.positions,
    path: formattedError.path,
    originalError: formattedError.originalError,
    extensions: {
      ...baseExtensions,
      // Only present in non-production to aid debugging
      internalMessage:
        internalMessage !== formattedError.message ? internalMessage : undefined,
    },
  });
}

// ── withResolverLogging wrapper ───────────────────────────────────────────────

type ResolverFn<TParent, TArgs, TContext, TReturn> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: any
) => Promise<TReturn> | TReturn;

/**
 * Wraps a resolver function with:
 * - Structured error logging (warn for operational, error for unexpected)
 * - Consistent error normalisation (unknown errors → ResolverError)
 * - Performance timing logged at debug level
 *
 * @param resolverName  Human-readable name, e.g. "Query.ledgers"
 * @param fn            The resolver implementation
 */
export function withResolverLogging<TParent = any, TArgs = any, TContext extends { logger?: winston.Logger; user?: { id: string } | null } = any, TReturn = any>(
  resolverName: string,
  fn: ResolverFn<TParent, TArgs, TContext, TReturn>
): ResolverFn<TParent, TArgs, TContext, TReturn> {
  return async (parent, args, context, info) => {
    const start = Date.now();
    const userId = context.user?.id;

    try {
      const result = await fn(parent, args, context, info);

      const duration = Date.now() - start;
      context.logger?.debug('Resolver completed', {
        resolver: resolverName,
        userId: userId ?? 'anonymous',
        durationMs: duration,
      });

      return result;
    } catch (err: unknown) {
      const duration = Date.now() - start;
      const { level, isOperational } = classifyError(err);
      const payload = formatErrorPayload(resolverName, err, args, userId);

      if (level === 'error') {
        context.logger?.error('Resolver unexpected error', { ...payload, durationMs: duration });
      } else {
        context.logger?.warn('Resolver operational error', { ...payload, durationMs: duration });
      }

      // Re-throw operational errors as-is (already GraphQLErrors with correct codes)
      if (isOperational) throw err;

      // Normalise unexpected errors so clients never see raw DB/system messages
      throw normaliseError(err);
    }
  };
}
