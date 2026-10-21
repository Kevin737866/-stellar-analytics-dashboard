import type { Pool } from 'pg';

export const RATE_LIMIT_WINDOW = 60 * 1000;
export const RATE_LIMIT_MAX = 100;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

// Single-process fallback; counters are not shared between replicas.
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly records = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number) {
    const now = Date.now();
    const record = this.records.get(key);
    if (!record || now >= record.resetAt) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.records.set(key, fresh);
      return { ...fresh };
    }
    record.count++;
    return { ...record };
  }

  prune(now = Date.now()) {
    for (const [key, val] of this.records) {
      if (now >= val.resetAt) this.records.delete(key);
    }
  }
}

// Issue #420: shared counters in Postgres so every API replica enforces the
// same budget per client. The upsert is atomic, so concurrent requests from
// different replicas cannot both observe a stale count.
export class PostgresRateLimitStore implements RateLimitStore {
  private ready: Promise<unknown> | null = null;

  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  private ensureTable() {
    this.ready ??= this.pool
      .query(
        `CREATE TABLE IF NOT EXISTS api_rate_limits (
          key TEXT PRIMARY KEY,
          count INTEGER NOT NULL,
          reset_at TIMESTAMPTZ NOT NULL
        )`
      )
      .catch((err) => {
        this.ready = null;
        throw err;
      });
    return this.ready;
  }

  async increment(key: string, windowMs: number) {
    await this.ensureTable();
    const { rows } = await this.pool.query(
      `INSERT INTO api_rate_limits (key, count, reset_at)
       VALUES ($1, 1, now() + ($2::int * interval '1 millisecond'))
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN api_rate_limits.reset_at <= now() THEN 1 ELSE api_rate_limits.count + 1 END,
         reset_at = CASE WHEN api_rate_limits.reset_at <= now() THEN EXCLUDED.reset_at ELSE api_rate_limits.reset_at END
       RETURNING count, reset_at`,
      [key, windowMs]
    );
    return { count: Number(rows[0].count), resetAt: new Date(rows[0].reset_at).getTime() };
  }

  async prune() {
    await this.ensureTable();
    await this.pool.query('DELETE FROM api_rate_limits WHERE reset_at <= now()');
  }
}

export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  max = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW
): Promise<RateLimitResult> {
  const { count, resetAt } = await store.increment(key, windowMs);
  return { allowed: count <= max, limit: max, remaining: Math.max(0, max - count), resetAt };
}

// Issue #421: IETF draft RateLimit-* headers plus Retry-After on rejection.
export function rateLimitHeaders(
  result: RateLimitResult,
  now = Date.now()
): Record<string, string> {
  const resetSeconds = Math.max(0, Math.ceil((result.resetAt - now) / 1000));
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(resetSeconds),
  };
  if (!result.allowed) headers['Retry-After'] = String(resetSeconds);
  return headers;
}
