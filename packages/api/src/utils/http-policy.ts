import type express from 'express';

type Env = Record<string, string | undefined>;

// Issue #423 – maximum accepted request body size (body-parser syntax).
export const DEFAULT_BODY_LIMIT = '100kb';

export function getBodyLimit(env: Env = process.env): string {
  return env.API_BODY_LIMIT?.trim() || DEFAULT_BODY_LIMIT;
}

export function payloadTooLargeHandler(
  err: any,
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Payload too large',
      message: `Request body exceeds the ${getBodyLimit()} limit`,
    });
    return;
  }
  next(err);
}

// Issue #424 – per-request HTTP timeout in milliseconds.
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

export function getRequestTimeoutMs(env: Env = process.env): number {
  const value = Number(env.API_REQUEST_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_REQUEST_TIMEOUT_MS;
}

// Issue #425 – introspection is disabled in production unless explicitly
// enabled with ALLOW_INTROSPECTION=true (and can be disabled anywhere with false).
export function isIntrospectionAllowed(env: Env = process.env): boolean {
  if (env.ALLOW_INTROSPECTION === 'true') return true;
  if (env.ALLOW_INTROSPECTION === 'false') return false;
  return env.NODE_ENV !== 'production';
}
